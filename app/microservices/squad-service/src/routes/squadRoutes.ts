import type { FastifyInstance } from "fastify";
import { requireIdentity } from "../auth.js";
import * as controller from "../controllers/squadController.js";

/** Every Squad endpoint requires a valid identity token. */
export async function squadRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireIdentity);

  app.get("/api/squads", controller.listSquads);
  app.post("/api/squads", controller.createSquad);
  app.post("/api/squads/join", controller.joinSquad);
  app.get("/api/squads/:squadId", controller.getSquad);
  app.delete("/api/squads/:squadId/membership", controller.leaveSquad);
}
