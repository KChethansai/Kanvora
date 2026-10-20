// templateAPI routes: Express endpoints for this backend resource.
import express from "express";

import {
  createTemplate,
  getTemplates,
  getTemplateById,
  toggleFavourite,
  togglePublished,
  updateTemplate,
  deleteTemplate
} from "../controllers/templeteContoler.js";

import { verifyRolesToken } from "../middlewares/verifyRolesToken.js";

export const templeteApp = express.Router();

const auth = verifyRolesToken(
  "MEMBER",
  "ADMIN",
  "MANAGER",
  "VIEWER"
);

// Account-wide role labels never substitute for resource ownership.
const write = auth;

// create + get all
templeteApp
  .route("/")
  .post(write, createTemplate)
  .get(auth, getTemplates);

// get single
templeteApp
  .route("/:id")
  .get(auth, getTemplateById);

// favourite
templeteApp.patch(
  "/:id/favourite",
  auth,
  toggleFavourite
);

// published
templeteApp.patch(
  "/:id/published",
  auth,
  togglePublished
);

// update
templeteApp.put(
  "/:id",
  auth,
  updateTemplate
);

// delete
templeteApp.delete(
  "/:id",
  auth,
  deleteTemplate
);

