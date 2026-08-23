/**
 * Soft match claim — informational only.
 * Others can see who claimed a match; anyone can still edit and save.
 * Claim persists until the claimer clicks Release (or someone Claims instead).
 * No heartbeats / TTL.
 */
(function (global) {
  "use strict";

  var ROOM_ID = "season5";
  var claimsRef = null;
  var claimsByMatch = Object.create(null);
  var listeners = [];
  var ready = false;
  var sessionId = null;
  var username = null;

  function notify() {
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i]();
      } catch (e) {
        /* ignore */
      }
    }
  }

  function normalizeClaim(raw) {
    if (!raw || typeof raw !== "object") return null;
    var sid = String(raw.sessionId || "").trim();
    var user = String(raw.username || "").trim();
    if (!sid || !user) return null;
    return {
      sessionId: sid,
      username: user,
      label: String(raw.label || user).trim() || user,
      claimedAt: Number(raw.claimedAt) || 0,
    };
  }

  function ClaimHub() {}

  ClaimHub.init = function () {
    if (ready) return Promise.resolve();
    sessionId = StatsHub.sessionId();
    username = StatsHub.username();
    return StatsHub.ready().then(function () {
      var db = firebase.database();
      claimsRef = db.ref("/matchClaims/" + ROOM_ID);
      claimsRef.on("value", function (snap) {
        var next = Object.create(null);
        var val = snap.val() || {};
        Object.keys(val).forEach(function (matchId) {
          var claim = normalizeClaim(val[matchId]);
          if (claim) next[matchId] = claim;
        });
        claimsByMatch = next;
        notify();
      });
      ready = true;
    });
  };

  ClaimHub.ready = function () {
    return ClaimHub.init();
  };

  ClaimHub.onChange = function (fn) {
    if (typeof fn === "function") listeners.push(fn);
  };

  ClaimHub.getClaim = function (matchId) {
    return claimsByMatch[String(matchId)] || null;
  };

  ClaimHub.isMine = function (matchId) {
    var claim = ClaimHub.getClaim(matchId);
    return !!(claim && claim.sessionId === sessionId);
  };

  ClaimHub.claim = function (matchId) {
    if (!claimsRef || !matchId) return Promise.resolve();
    var payload = {
      sessionId: sessionId,
      username: username,
      label: username,
      claimedAt: firebase.database.ServerValue.TIMESTAMP,
    };
    return claimsRef.child(String(matchId)).set(payload);
  };

  ClaimHub.release = function (matchId) {
    if (!claimsRef || !matchId) return Promise.resolve();
    return claimsRef.child(String(matchId)).remove();
  };

  global.ClaimHub = ClaimHub;
})(typeof window !== "undefined" ? window : global);
