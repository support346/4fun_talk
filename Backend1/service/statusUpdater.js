import User from "../modeles/user.model.js";
import { getOnlineUsers } from "../config/socket.js";

/**
 * Reset all users' statuses to offline if they are currently marked as online/incall.
 * This is primarily useful on server startup to handle cases where the server crashed
 * while users had active connections, leaving them permanently stuck as 'online'.
 */
export const resetAllUsersToOffline = async () => {
  try {
    const result = await User.updateMany(
      { userCurrentStatus: { $in: ["online", "incall"] } },
      { 
        userCurrentStatus: "offline",
        lastSeen: new Date()
      }
    );
    console.log(`[StatusUpdater] Startup Cleanup: Set ${result.modifiedCount} users to offline.`);
  } catch (error) {
    console.error("[StatusUpdater] Error during startup cleanup:", error);
  }
};

/**
 * Periodically synchronize the database user status with the active in-memory socket map.
 * This fixes users who might have lost connection without triggering a 'disconnect' event.
 */
export const startStatusUpdater = () => {
  const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  setInterval(async () => {
    try {
      const onlineUsersMap = getOnlineUsers();
      // Get array of actve socket user IDs
      const activeUserIds = Array.from(onlineUsersMap.keys());

      // Find users who are marked as online/incall but are NOT in the active socket map
      const result = await User.updateMany(
        { 
          userCurrentStatus: { $in: ["online", "incall"] },
          _id: { $nin: activeUserIds } 
        },
        { 
          userCurrentStatus: "offline",
          lastSeen: new Date()
        }
      );

      if (result.modifiedCount > 0) {
        console.log(`[StatusUpdater] Background Sync: Set ${result.modifiedCount} inactive users to offline.`);
      }
    } catch (error) {
      console.error("[StatusUpdater] Error during background sync:", error);
    }
  }, SYNC_INTERVAL_MS);

  console.log(`[StatusUpdater] Background status sync started (Interval: 5m)`);
};
