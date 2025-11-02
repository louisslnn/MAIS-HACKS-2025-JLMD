import { Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";

import { db } from "./config";

const acceptFriendInviteSchema = z.object({
  inviterUid: z.string().min(1, "Missing inviter uid"),
});

export const acceptFriendInvite = onCall(
  { enforceAppCheck: false, region: "us-central1" },
  async (request) => {
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Sign in to accept invites.");
      }

      const parsed = acceptFriendInviteSchema.safeParse(request.data);
      if (!parsed.success) {
        logger.warn("Invalid acceptFriendInvite payload", {
          errors: parsed.error.flatten(),
        });
        throw new HttpsError("invalid-argument", "Invalid invite payload.");
      }

      const inviterUid = parsed.data.inviterUid;
      const inviteeUid = request.auth.uid;

      if (inviterUid === inviteeUid) {
        throw new HttpsError(
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
          throw new HttpsError("not-found", "Invited user no longer exists.");
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
      if (error instanceof HttpsError) {
        throw error;
      }

      logger.error("acceptFriendInvite failed", {
        error: error instanceof Error ? error.message : String(error),
        inviterUid: request.data?.inviterUid,
        inviteeUid: request.auth?.uid,
      });

      throw new HttpsError("internal", "Failed to accept invite.");
    }
  },
);
