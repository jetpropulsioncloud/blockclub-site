const { defineSecret } = require("firebase-functions/params");
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { sendVote } = require("@hytaleone/votifier");

admin.initializeApp();
const paypalClientId = defineSecret("PAYPAL_CLIENT_ID");
const paypalClientSecret = defineSecret("PAYPAL_CLIENT_SECRET");
const paypalWebhookId = defineSecret("PAYPAL_WEBHOOK_ID");

const PAYPAL_API_BASE = "https://api-m.sandbox.paypal.com";

const PAYPAL_PLAN_TIERS = {
  "P-3GB13984SA584183ENIIHHHA": "creator",
  "P-9NH09654NT747502SNIIHIRQ": "boost",
  "P-9HK91521DV8272417NIIHJCA": "realm"
};

const PREMIUM_FEATURES = {
  creator: {
    maxPages: 3,
    customBackgrounds: true,
    higherBuilderLimits: true,
    premiumBadge: true,
    featuredListing: false,
    featuredServerPage: false,
    homepageFeaturedEligible: false,
    earlyAccess: false
  },
  boost: {
    maxPages: 3,
    customBackgrounds: true,
    higherBuilderLimits: true,
    premiumBadge: true,
    featuredListing: true,
    featuredServerPage: true,
    homepageFeaturedEligible: true,
    earlyAccess: false
  },
  realm: {
    maxPages: 5,
    customBackgrounds: true,
    higherBuilderLimits: true,
    premiumBadge: true,
    featuredListing: true,
    featuredServerPage: true,
    homepageFeaturedEligible: true,
    earlyAccess: true
  }
};
function applyCors(req, res) {
  const allowedOrigins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "https://blockclub-4742a.web.app",
    "https://blockclub-4742a.firebaseapp.com"
  ];

  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  }

  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}
function safeDocId(value) {
  return String(value || "").replace(/\//g, "_").slice(0, 500);
}

function getTierFromPlanId(planId) {
  const cleanPlanId = String(planId || "").trim();

  if (!cleanPlanId) {
    return "";
  }

  const tier = PAYPAL_PLAN_TIERS[cleanPlanId];

  return tier || "";
}

function getPremiumFeatures(tier) {
  return PREMIUM_FEATURES[tier] || null;
}

function parsePaypalCustomId(customId) {
  const parts = String(customId || "").split("|");

  return {
    uid: String(parts[0] || "").trim(),
    serverId: String(parts[1] || "").trim(),
    requestedTier: String(parts[2] || "").trim()
  };
}

function getPaypalSubscriptionId(resource) {
  return String(
    resource?.id ||
    resource?.billing_agreement_id ||
    resource?.subscription_id ||
    resource?.supplementary_data?.related_ids?.subscription_id ||
    ""
  ).trim();
}

function getPaypalPayerEmail(resource) {
  return String(
    resource?.subscriber?.email_address ||
    resource?.payer?.email_address ||
    ""
  ).trim();
}

function isPaypalActiveEvent(eventType) {
  return eventType === "BILLING.SUBSCRIPTION.ACTIVATED";
}

function isPaypalInactiveEvent(eventType) {
  return [
    "BILLING.SUBSCRIPTION.CANCELLED",
    "BILLING.SUBSCRIPTION.SUSPENDED",
    "BILLING.SUBSCRIPTION.EXPIRED"
  ].includes(eventType);
}

function getInactiveStatus(eventType) {
  if (eventType === "BILLING.SUBSCRIPTION.CANCELLED") return "cancelled";
  if (eventType === "BILLING.SUBSCRIPTION.SUSPENDED") return "suspended";
  if (eventType === "BILLING.SUBSCRIPTION.EXPIRED") return "expired";
  return "inactive";
}

async function getPaypalAccessToken() {
  const clientId = paypalClientId.value();
  const clientSecret = paypalClientSecret.value();

  const credentials = Buffer
    .from(`${clientId}:${clientSecret}`)
    .toString("base64");

  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.access_token) {
    console.error("PayPal access token failed:", data);
    throw new Error("Could not get PayPal access token.");
  }

  return data.access_token;
}

async function verifyPaypalWebhook(req, eventBody) {
  const accessToken = await getPaypalAccessToken();

  const verificationPayload = {
    transmission_id: req.headers["paypal-transmission-id"],
    transmission_time: req.headers["paypal-transmission-time"],
    cert_url: req.headers["paypal-cert-url"],
    auth_algo: req.headers["paypal-auth-algo"],
    transmission_sig: req.headers["paypal-transmission-sig"],
    webhook_id: paypalWebhookId.value(),
    webhook_event: eventBody
  };

  const response = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(verificationPayload)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("PayPal webhook verification request failed:", data);
    return false;
  }

  return data.verification_status === "SUCCESS";
}

async function findServerByPaypalSubscription(db, subscriptionId) {
  const snap = await db
    .collection("servers")
    .where("paypalSubscriptionId", "==", subscriptionId)
    .limit(1)
    .get();

  if (snap.empty) {
    return null;
  }

  const docSnap = snap.docs[0];

  return {
    serverId: docSnap.id,
    serverData: docSnap.data() || {}
  };
}
exports.vote = functions.https.onRequest(async (req, res) => {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { serverId, minecraftUsername } = req.body || {};

    if (!serverId || !minecraftUsername) {
      return res.status(400).json({ error: "Missing serverId or minecraftUsername" });
    }

    const cleanUsername = String(minecraftUsername).trim();

    if (!cleanUsername) {
      return res.status(400).json({ error: "Minecraft username is required" });
    }

    const db = admin.firestore();
    const serverRef = db.collection("servers").doc(serverId);
    const configRef = serverRef.collection("private").doc("config");

    const [serverSnap, configSnap] = await Promise.all([
      serverRef.get(),
      configRef.get()
    ]);

    if (!serverSnap.exists) {
      return res.status(404).json({ error: "Server not found" });
    }

    const serverData = serverSnap.data() || {};

    if (!serverData.votingEnabled) {
      return res.status(400).json({ error: "Voting is disabled for this server" });
    }

    if (!configSnap.exists) {
      return res.status(400).json({ error: "Voting config not found" });
    }

    const config = configSnap.data() || {};

    const votifierHost = String(config.votifierHost || "").trim();
    const votifierPort = Number(config.votifierPort || 8192);
    const votifierToken = String(config.votifierToken || "").trim();
    const votifierServiceName = String(config.votifierServiceName || "blockclub").trim();
    const voteCooldownHours = Number(config.voteCooldownHours || 24);

    if (!votifierHost || !votifierPort || !votifierToken) {
      return res.status(400).json({ error: "Votifier config is incomplete" });
    }

    const now = Date.now();
    const cooldownMs = voteCooldownHours * 60 * 60 * 1000;

    const existingVotesSnap = await serverRef
      .collection("votes")
      .where("minecraftUsername", "==", cleanUsername)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (!existingVotesSnap.empty) {
      const lastVote = existingVotesSnap.docs[0].data() || {};
      const lastVoteMs = lastVote.createdAt?.toMillis?.() || 0;

      if (lastVoteMs && now - lastVoteMs < cooldownMs) {
        const hoursRemaining = Math.ceil((cooldownMs - (now - lastVoteMs)) / (1000 * 60 * 60));
        return res.status(429).json({
          error: `You already voted recently. Try again in about ${hoursRemaining} hour(s).`
        });
      }
    }

    const voteResult = await sendVote({
      server: {
        protocol: "v2",
        host: votifierHost,
        port: votifierPort,
        token: votifierToken,
        timeout: 5000
      },
      vote: {
        username: cleanUsername,
        serviceName: votifierServiceName,
        address: req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.ip || "127.0.0.1",
        timestamp: now
      }
    });

    if (!voteResult.success) {
      console.error("NuVotifier delivery failed:", voteResult);
      return res.status(502).json({
        error: `Vote delivery failed: ${voteResult.message || "unknown error"}`
      });
    }

    const voteRef = serverRef.collection("votes").doc();

    await voteRef.set({
      minecraftUsername: cleanUsername,
      source: "blockclub",
      delivered: true,
      deliveredAt: admin.firestore.FieldValue.serverTimestamp(),
      failureReason: null,
      protocol: "v2",
      serviceName: votifierServiceName,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await serverRef.update({
      totalVotes: admin.firestore.FieldValue.increment(1),
      lastVoteAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.status(200).json({
      ok: true,
      totalVotes: Number(serverData.totalVotes || 0) + 1
    });
  } catch (err) {
    console.error("vote endpoint failed:", err);
    return res.status(500).json({ error: err?.message || "Internal server error" });
  }
});

exports.testVote = functions.https.onRequest(async (req, res) => {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { serverId } = req.body || {};

    if (!serverId) {
      return res.status(400).json({ error: "Missing serverId" });
    }

    const db = admin.firestore();
    const serverRef = db.collection("servers").doc(serverId);
    const configRef = serverRef.collection("private").doc("config");

    const [serverSnap, configSnap] = await Promise.all([
      serverRef.get(),
      configRef.get()
    ]);

    if (!serverSnap.exists) {
      return res.status(404).json({ error: "Server not found" });
    }

    if (!configSnap.exists) {
      return res.status(404).json({ error: "Voting config not found" });
    }

    const config = configSnap.data() || {};

    if (!config.votingEnabled) {
      return res.status(400).json({ error: "Voting is disabled for this server" });
    }

    const host = String(config.votifierHost || "").trim();
    const port = Number(config.votifierPort || 8192);
    const token = String(config.votifierToken || "").trim();
    const serviceName = String(config.votifierServiceName || "blockclub").trim();

    if (!host || !port || !token) {
      return res.status(400).json({ error: "Incomplete voting config" });
    }

    const voteResult = await sendVote({
      server: {
        protocol: "v2",
        host,
        port,
        token,
        timeout: 5000
      },
      vote: {
        username: "TestVoteUser",
        serviceName,
        address: "127.0.0.1",
        timestamp: Date.now()
      }
    });

    if (!voteResult.success) {
      console.error("Test vote delivery failed:", voteResult);
      return res.status(502).json({
        error: `Test vote delivery failed: ${voteResult.message || "unknown error"}`
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Test vote sent successfully."
    });
  } catch (err) {
    console.error("testVote failed:", err);
    return res.status(500).json({
      error: err?.message || "Test vote failed."
    });
  }
exports.paypalWebhook = functions
  .runWith({
    secrets: [
      paypalClientId,
      paypalClientSecret,
      paypalWebhookId
    ]
  })
  .https.onRequest(async (req, res) => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const event = req.body || {};
      const eventId = safeDocId(event.id || "");
      const eventType = String(event.event_type || "").trim();
      const resource = event.resource || {};

      if (!eventId || !eventType) {
        return res.status(400).json({ error: "Invalid PayPal webhook event." });
      }

      const verified = await verifyPaypalWebhook(req, event);

      if (!verified) {
        return res.status(401).json({ error: "PayPal webhook verification failed." });
      }

      const db = admin.firestore();
      const eventRef = db.collection("paypalWebhookEvents").doc(eventId);
      const existingEvent = await eventRef.get();

      if (existingEvent.exists) {
        return res.status(200).json({
          ok: true,
          duplicate: true
        });
      }

      const subscriptionId = getPaypalSubscriptionId(resource);
      const planId = String(resource.plan_id || "").trim();
      const tier = getTierFromPlanId(planId);
      const custom = parsePaypalCustomId(resource.custom_id);
      const payerEmail = getPaypalPayerEmail(resource);

      await eventRef.set({
        eventId,
        eventType,
        subscriptionId,
        planId,
        tier,
        uid: custom.uid || "",
        serverId: custom.serverId || "",
        requestedTier: custom.requestedTier || "",
        payerEmail,
        processed: false,
        ignored: false,
        receivedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      if (!subscriptionId) {
        await eventRef.set({
          ignored: true,
          ignoreReason: "Missing subscription ID",
          processedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        return res.status(200).json({
          ok: true,
          ignored: true
        });
      }

      if (isPaypalActiveEvent(eventType)) {
        if (!custom.uid || !custom.serverId) {
          await eventRef.set({
            ignored: true,
            ignoreReason: "Missing uid or serverId in custom_id",
            processedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

          return res.status(200).json({
            ok: true,
            ignored: true
          });
        }

        if (!tier) {
          await eventRef.set({
            ignored: true,
            ignoreReason: "Unknown PayPal plan ID",
            processedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

          return res.status(200).json({
            ok: true,
            ignored: true
          });
        }

        const serverRef = db.collection("servers").doc(custom.serverId);
        const serverSnap = await serverRef.get();

        if (!serverSnap.exists) {
          await eventRef.set({
            ignored: true,
            ignoreReason: "Server not found",
            processedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

          return res.status(200).json({
            ok: true,
            ignored: true
          });
        }

        const serverData = serverSnap.data() || {};

        if (serverData.ownerUid !== custom.uid) {
          await eventRef.set({
            ignored: true,
            ignoreReason: "Server owner does not match PayPal custom_id uid",
            actualOwnerUid: serverData.ownerUid || "",
            processedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

          return res.status(200).json({
            ok: true,
            ignored: true
          });
        }

        const features = getPremiumFeatures(tier);
        const batch = db.batch();

        batch.set(serverRef, {
          premiumActive: true,
          premiumTier: tier,
          premiumStatus: "active",
          premiumProvider: "paypal",
          paypalSubscriptionId: subscriptionId,
          paypalPlanId: planId,
          premiumFeatures: features,
          premiumUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        batch.set(
          serverRef.collection("billing").doc("paypal"),
          {
            provider: "paypal",
            subscriptionId,
            planId,
            tier,
            status: "active",
            uid: custom.uid,
            serverId: custom.serverId,
            payerEmail,
            lastEventId: eventId,
            lastEventType: eventType,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );

        batch.set(
          db.collection("users").doc(custom.uid).collection("billing").doc(`paypal_${custom.serverId}`),
          {
            provider: "paypal",
            subscriptionId,
            planId,
            tier,
            status: "active",
            serverId: custom.serverId,
            payerEmail,
            lastEventId: eventId,
            lastEventType: eventType,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );

        batch.set(eventRef, {
          processed: true,
          processedAction: "activated_premium",
          processedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        await batch.commit();

        return res.status(200).json({
          ok: true,
          activated: true,
          tier
        });
      }

      if (isPaypalInactiveEvent(eventType)) {
        let serverId = custom.serverId;
        let uid = custom.uid;

        if (!serverId) {
          const found = await findServerByPaypalSubscription(db, subscriptionId);

          if (found) {
            serverId = found.serverId;
            uid = found.serverData.ownerUid || "";
          }
        }

        if (!serverId) {
          await eventRef.set({
            ignored: true,
            ignoreReason: "Could not find server for inactive subscription",
            processedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

          return res.status(200).json({
            ok: true,
            ignored: true
          });
        }

        const inactiveStatus = getInactiveStatus(eventType);
        const serverRef = db.collection("servers").doc(serverId);
        const batch = db.batch();

        batch.set(serverRef, {
          premiumActive: false,
          premiumTier: "free",
          previousPremiumTier: tier || custom.requestedTier || "",
          premiumStatus: inactiveStatus,
          premiumProvider: "paypal",
          paypalSubscriptionId: subscriptionId,
          paypalPlanId: planId || "",
          premiumFeatures: null,
          premiumUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        batch.set(
          serverRef.collection("billing").doc("paypal"),
          {
            provider: "paypal",
            subscriptionId,
            planId: planId || "",
            tier: tier || custom.requestedTier || "",
            status: inactiveStatus,
            uid: uid || "",
            serverId,
            payerEmail,
            lastEventId: eventId,
            lastEventType: eventType,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );

        if (uid) {
          batch.set(
            db.collection("users").doc(uid).collection("billing").doc(`paypal_${serverId}`),
            {
              provider: "paypal",
              subscriptionId,
              planId: planId || "",
              tier: tier || custom.requestedTier || "",
              status: inactiveStatus,
              serverId,
              payerEmail,
              lastEventId: eventId,
              lastEventType: eventType,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            },
            { merge: true }
          );
        }

        batch.set(eventRef, {
          processed: true,
          processedAction: "deactivated_premium",
          processedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        await batch.commit();

        return res.status(200).json({
          ok: true,
          deactivated: true,
          status: inactiveStatus
        });
      }

      if (
        eventType === "PAYMENT.SALE.COMPLETED" ||
        eventType === "PAYMENT.CAPTURE.COMPLETED"
      ) {
        const found = await findServerByPaypalSubscription(db, subscriptionId);

        if (found) {
          const serverRef = db.collection("servers").doc(found.serverId);

          await serverRef.collection("billing").doc("paypal").set({
            lastPaymentEventId: eventId,
            lastPaymentEventType: eventType,
            lastPaymentAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        }

        await eventRef.set({
          processed: true,
          processedAction: "recorded_payment_event",
          processedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        return res.status(200).json({
          ok: true,
          paymentRecorded: true
        });
      }

      await eventRef.set({
        ignored: true,
        ignoreReason: "Unhandled event type",
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      return res.status(200).json({
        ok: true,
        ignored: true,
        eventType
      });
    } catch (err) {
      console.error("paypalWebhook failed:", err);

      return res.status(500).json({
        error: err?.message || "PayPal webhook failed."
      });
    }
  });
});