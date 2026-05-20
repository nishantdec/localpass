/**
 * NorthLocker — webauthn_interceptor.js
 * =====================================
 * Injected into the MAIN world of webpage to intercept WebAuthn API calls
 * (navigator.credentials.create / get) and route them to the extension.
 */
(function() {
  'use strict';

  // Check if WebAuthn is supported
  if (!window.navigator || !window.navigator.credentials) return;

  const originalCreate = window.navigator.credentials.create.bind(window.navigator.credentials);
  const originalGet = window.navigator.credentials.get.bind(window.navigator.credentials);

  const pendingRequests = new Map();

  function generateId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  function arrayBufferToBase64URL(buffer) {
    if (!buffer) return "";
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }

  function base64URLToArrayBuffer(base64url) {
    let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (msg && msg.source === "northlocker-content" && msg.requestId) {
      const p = pendingRequests.get(msg.requestId);
      if (p) {
        pendingRequests.delete(msg.requestId);
        if (msg.error) {
          p.reject(new DOMException(msg.error, "NotAllowedError"));
        } else {
          p.resolve(msg.result);
        }
      }
    }
  });

  // Intercept Credential Creation (Registration)
  window.navigator.credentials.create = function(options) {
    if (options && options.publicKey) {
      return new Promise((resolve, reject) => {
        const requestId = generateId();
        pendingRequests.set(requestId, { resolve, reject });

        const pk = options.publicKey;
        const msg = {
          source: "northlocker-interceptor",
          type: "WEBAUTHN_CREATE",
          requestId,
          rp: pk.rp,
          user: {
            id: arrayBufferToBase64URL(pk.user.id),
            name: pk.user.name,
            displayName: pk.user.displayName
          },
          challenge: arrayBufferToBase64URL(pk.challenge)
        };
        window.postMessage(msg, "*");
      }).then(res => {
        // Build standard PublicKeyCredential registration response
        const clientData = {
          type: "webauthn.create",
          challenge: arrayBufferToBase64URL(options.publicKey.challenge),
          origin: window.location.origin,
          crossOrigin: false
        };
        const clientDataJSON = new TextEncoder().encode(JSON.stringify(clientData)).buffer;
        const attestationObject = base64URLToArrayBuffer(res.attestation_object || "");
        const rawId = base64URLToArrayBuffer(res.credential_id);

        const responseObj = Object.create(AuthenticatorAttestationResponse.prototype);
        Object.defineProperty(responseObj, 'clientDataJSON', { value: clientDataJSON, enumerable: true });
        Object.defineProperty(responseObj, 'attestationObject', { value: attestationObject, enumerable: true });
        Object.defineProperty(responseObj, 'getTransports', { value: () => ["internal"], enumerable: true });
        Object.defineProperty(responseObj, 'getAuthenticatorData', { value: () => base64URLToArrayBuffer(res.authenticator_data || ""), enumerable: true });
        Object.defineProperty(responseObj, 'getPublicKey', { value: () => base64URLToArrayBuffer(res.public_key_cbor || ""), enumerable: true });
        Object.defineProperty(responseObj, 'getPublicKeyAlgorithm', { value: () => -7, enumerable: true });

        const credentialObj = Object.create(PublicKeyCredential.prototype);
        Object.defineProperty(credentialObj, 'id', { value: res.credential_id, enumerable: true });
        Object.defineProperty(credentialObj, 'rawId', { value: rawId, enumerable: true });
        Object.defineProperty(credentialObj, 'type', { value: "public-key", enumerable: true });
        Object.defineProperty(credentialObj, 'response', { value: responseObj, enumerable: true });

        return credentialObj;
      });
    }
    return originalCreate(options);
  };

  // Intercept Credential Get (Assertion)
  window.navigator.credentials.get = function(options) {
    if (options && options.publicKey) {
      return new Promise((resolve, reject) => {
        const requestId = generateId();
        pendingRequests.set(requestId, { resolve, reject });

        const pk = options.publicKey;
        const credentialIds = (pk.allowCredentials || []).map(cred => arrayBufferToBase64URL(cred.id));

        const msg = {
          source: "northlocker-interceptor",
          type: "WEBAUTHN_GET",
          requestId,
          rpId: pk.rpId || window.location.hostname,
          challenge: arrayBufferToBase64URL(pk.challenge),
          credentialIds
        };
        window.postMessage(msg, "*");
      }).then(res => {
        // Build standard PublicKeyCredential assertion response
        const clientData = {
          type: "webauthn.get",
          challenge: arrayBufferToBase64URL(options.publicKey.challenge),
          origin: window.location.origin,
          crossOrigin: false
        };
        const clientDataJSON = new TextEncoder().encode(JSON.stringify(clientData)).buffer;
        const authenticatorData = base64URLToArrayBuffer(res.authenticator_data);
        const signature = base64URLToArrayBuffer(res.signature);
        const rawId = base64URLToArrayBuffer(res.credential_id);
        const userHandle = res.user_handle ? base64URLToArrayBuffer(res.user_handle) : new ArrayBuffer(0);

        const responseObj = Object.create(AuthenticatorAssertionResponse.prototype);
        Object.defineProperty(responseObj, 'clientDataJSON', { value: clientDataJSON, enumerable: true });
        Object.defineProperty(responseObj, 'authenticatorData', { value: authenticatorData, enumerable: true });
        Object.defineProperty(responseObj, 'signature', { value: signature, enumerable: true });
        Object.defineProperty(responseObj, 'userHandle', { value: userHandle, enumerable: true });

        const credentialObj = Object.create(PublicKeyCredential.prototype);
        Object.defineProperty(credentialObj, 'id', { value: res.credential_id, enumerable: true });
        Object.defineProperty(credentialObj, 'rawId', { value: rawId, enumerable: true });
        Object.defineProperty(credentialObj, 'type', { value: "public-key", enumerable: true });
        Object.defineProperty(credentialObj, 'response', { value: responseObj, enumerable: true });

        return credentialObj;
      });
    }
    return originalGet(options);
  };

})();
