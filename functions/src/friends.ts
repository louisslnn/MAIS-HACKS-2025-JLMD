import { Timestamp } from "firebase-admin/firestore";
import * as functions from "firebase-functions/v1";
import { logger } from "firebase-functions";
import { z } from "zod";

import { db } from "./config";

const acceptFriendInviteSchema = z.object({
  inviterUid: z.string().min(1, "Missing inviter uid"),
});

export const acceptFriendInvite = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    try {
      if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Sign in to accept invites.");
      }

      const parsed = acceptFriendInviteSchema.safeParse(data);
      if (!parsed.success) {
        logger.warn("Invalid acceptFriendInvite payload", {
          errors: parsed.error.flatten(),
        });
        throw new functions.https.HttpsError("invalid-argument", "Invalid invite payload.");
      }

      const inviterUid = parsed.data.inviterUid;
      const inviteeUid = context.auth.uid;

      if (inviterUid === inviteeUid) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "You cannot add yourself as a friend.",
        );
      }

      const inviterRef = db.collection("users").doc(inviterUid);
      const inviteeRef = db.collection("users").doc(inviteeUid);

      const now = Timestamp.now();

      const result = await db.runTransaction(async (tx) => {
        const inviterSnap = await tx.get(inviterRef);
        if (!inviterSnap.exists) {
          throw new functions.https.HttpsError("not-found", "Invited user no longer exists.");
        }

        const inviteeSnap = await tx.get(inviteeRef);
        if (!inviteeSnap.exists) {
          logger.info("Creating placeholder user document for invitee", {
            inviteeUid,
          });
          tx.set(inviteeRef, { createdAt: now }, { merge: true });
        }

        const inviteeFriendRef = inviteeRef.collection("friends").doc(inviterUid);
        const inviterFriendRef = inviterRef.collection("friends").doc(inviteeUid);

        const [inviteeFriendSnap, inviterFriendSnap] = await Promise.all([
          tx.get(inviteeFriendRef),
          tx.get(inviterFriendRef),
        ]);

        const alreadyFriends = (
          inviteeFriendSnap.exists && inviterFriendSnap.exists
        );

        if (!inviteeFriendSnap.exists) {
          tx.set(inviteeFriendRef, {
            friendUid: inviterUid,
            addedAt: now,
            inviters: [inviterUid],
          });
        }

        if (!inviterFriendSnap.exists) {
          tx.set(inviterFriendRef, {
            friendUid: inviteeUid,
            addedAt: now,
            inviters: [inviterUid],
          });
        }

        return { alreadyFriends };
      });

      return {
        success: true,
        alreadyFriends: result.alreadyFriends,
      };
    } catch (error) {
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      logger.error("acceptFriendInvite failed", {
        error: error instanceof Error ? error.message : String(error),
        inviterUid: data?.inviterUid,
        inviteeUid: context.auth?.uid,
      });

      throw new functions.https.HttpsError("internal", "Failed to accept invite.");
    }
  });

const sendFriendRequestSchema = z.object({
  targetUid: z.string().min(1, "Missing target uid"),
});

export const sendFriendRequest = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    try {
      if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Sign in to send friend requests.");
      }

      const parsed = sendFriendRequestSchema.safeParse(data);
      if (!parsed.success) {
        logger.warn("Invalid sendFriendRequest payload", {
          errors: parsed.error.flatten(),
        });
        throw new functions.https.HttpsError("invalid-argument", "Invalid request payload.");
      }

      const senderUid = context.auth.uid;
      const targetUid = parsed.data.targetUid;

      if (senderUid === targetUid) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "You cannot send a friend request to yourself.",
        );
      }

      const senderRef = db.collection("users").doc(senderUid);
      const targetRef = db.collection("users").doc(targetUid);
      const now = Timestamp.now();

      const result = await db.runTransaction(async (tx) => {
        const [senderSnap, targetSnap] = await Promise.all([
          tx.get(senderRef),
          tx.get(targetRef),
        ]);

        if (!targetSnap.exists) {
          throw new functions.https.HttpsError("not-found", "We could not find that player.");
        }

        if (!senderSnap.exists) {
          logger.info("Creating placeholder user document for sender", {
            senderUid,
          });
          tx.set(senderRef, { createdAt: now }, { merge: true });
        }

        const senderFriendRef = senderRef.collection("friends").doc(targetUid);
        const targetFriendRef = targetRef.collection("friends").doc(senderUid);

        const [senderFriendSnap, targetFriendSnap] = await Promise.all([
          tx.get(senderFriendRef),
          tx.get(targetFriendRef),
        ]);

        if (senderFriendSnap.exists && targetFriendSnap.exists) {
          return { alreadyFriends: true };
        }

        const incomingRequestRef = senderRef
          .collection("friendRequests")
          .doc(targetUid);

        const incomingRequestSnap = await tx.get(incomingRequestRef);

        if (incomingRequestSnap.exists) {
          if (!senderFriendSnap.exists) {
            tx.set(senderFriendRef, {
              friendUid: targetUid,
              addedAt: now,
              inviters: [targetUid],
            });
          }

          if (!targetFriendSnap.exists) {
            tx.set(targetFriendRef, {
              friendUid: senderUid,
              addedAt: now,
              inviters: [targetUid],
            });
          }

          tx.delete(incomingRequestRef);

          return { autoAccepted: true };
        }

        const requestRef = targetRef
          .collection("friendRequests")
          .doc(senderUid);
        const requestSnap = await tx.get(requestRef);

        if (requestSnap.exists) {
          return { alreadyPending: true };
        }

        const senderData = senderSnap.data() ?? {};

        tx.set(requestRef, {
          senderUid,
          senderDisplayName: senderData.displayName ?? "Anonymous",
          senderRating: senderData.rating ?? 1000,
          senderPhotoURL: senderData.photoURL ?? null,
          createdAt: now,
          status: "pending",
          read: false,
        });

        return { requestCreated: true };
      });

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      logger.error("sendFriendRequest failed", {
        error: error instanceof Error ? error.message : String(error),
        targetUid: data?.targetUid,
        senderUid: context.auth?.uid,
      });

      throw new functions.https.HttpsError("internal", "Failed to send friend request.");
    }
  });

