const VOID_LEDGER_ENDPOINT = "http://127.0.0.1:3000/api/overwolf/inventory";
const WARFRAME_GAME_ID = 8954;
const REQUIRED_FEATURES = ["inventory", "match_info"];

let lastPostedInventory = "";
let lastPostTime = 0;

function log(message, detail) {
  if (detail === undefined) {
    console.log(`[VoidLedgerBridge] ${message}`);
  } else {
    console.log(`[VoidLedgerBridge] ${message}`, detail);
  }
}

function postJson(url, body) {
  const payload = JSON.stringify(body);

  if (window.fetch) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onload = () => resolve(xhr);
    xhr.onerror = () => reject(new Error("Failed to post inventory payload"));
    xhr.send(payload);
  });
}

async function forwardInventory(inventory, eventType) {
  const inventoryText = typeof inventory === "string" ? inventory : JSON.stringify(inventory);

  if (inventoryText === lastPostedInventory && Date.now() - lastPostTime < 5000) {
    return;
  }

  lastPostedInventory = inventoryText;
  lastPostTime = Date.now();

  try {
    const response = await postJson(VOID_LEDGER_ENDPOINT, {
      source: "void-ledger-overwolf-bridge",
      eventType,
      gameId: WARFRAME_GAME_ID,
      feature: "inventory",
      inventory,
    });
    log(`Posted inventory event to Void Ledger (${response.status || "ok"}).`);
  } catch (error) {
    log("Failed to post inventory event. Is Void Ledger running on localhost:3000?", error);
  }
}

function inspectInfoPayload(info, eventType) {
  const inventory = info?.info?.match_info?.inventory ?? info?.info?.inventory;

  if (inventory !== undefined && inventory !== null) {
    void forwardInventory(inventory, eventType);
  }
}

function setRequiredFeatures() {
  overwolf.games.events.setRequiredFeatures(REQUIRED_FEATURES, (result) => {
    if (!result?.success) {
      log("Required features unavailable; retrying.", result);
      setTimeout(setRequiredFeatures, 3000);
      return;
    }

    log("Required features enabled.", result);
    overwolf.games.events.getInfo((info) => inspectInfoPayload(info?.res ?? info, "getInfo"));
  });
}

overwolf.games.events.onInfoUpdates2.addListener((info) => {
  inspectInfoPayload(info, "onInfoUpdates2");
});

overwolf.games.events.onError.addListener((error) => {
  log("Overwolf game-event error.", error);
});

setRequiredFeatures();
