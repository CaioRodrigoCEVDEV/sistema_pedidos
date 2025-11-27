const express = require("express");
const router = express.Router();
const partGroupController = require("../controllers/partGroupController");
const requireAdmin = require("../middlewares/adminMiddleware");

/**
 * Part Group Routes
 * All routes require admin authentication
 */

// List all part groups
router.get("/part-groups", requireAdmin, partGroupController.listGroups);

// Get available parts for grouping
router.get("/part-groups/available-parts", requireAdmin, partGroupController.getAvailableParts);

// Get a single group by ID with its parts
router.get("/part-groups/:id", requireAdmin, partGroupController.getGroup);

// Get audit history for a group
router.get("/part-groups/:id/audit", requireAdmin, partGroupController.getGroupAuditHistory);

// Get stock for a specific part's group
router.get("/part-groups/part/:partId/stock", requireAdmin, partGroupController.getPartGroupStock);

// Create a new part group
router.post("/part-groups", requireAdmin, partGroupController.createGroup);

// Update a part group
router.put("/part-groups/:id", requireAdmin, partGroupController.updateGroup);

// Update group stock directly
router.put("/part-groups/:id/stock", requireAdmin, partGroupController.updateGroupStock);

// Add a part to a group
router.post("/part-groups/:id/parts", requireAdmin, partGroupController.addPartToGroup);

// Remove a part from its group
router.delete("/part-groups/parts/:partId", requireAdmin, partGroupController.removePartFromGroup);

// Delete a part group
router.delete("/part-groups/:id", requireAdmin, partGroupController.deleteGroup);

module.exports = router;
