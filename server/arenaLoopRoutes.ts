import { Router } from "express";
import {
  ArenaLoopValidationError,
  DEFAULT_ARENA_LOOP_FILE,
  appendArenaBattleTurn,
  buildArenaBattleJsonlExport,
  buildArenaBattleResearchBundleZip,
  createArenaBattle,
  findArenaBattle,
  readArenaBattles,
  reconstructArenaBattleReplay,
  runArenaBattleTurnWithSearch,
  updateArenaBattle,
  updateArenaBattleGoal,
} from "./arenaLoopStore";

export function createArenaLoopRouter(storeFile = DEFAULT_ARENA_LOOP_FILE) {
  const router = Router();

  router.get("/battle", (_req, res) => {
    res.json({ success: true, battles: readArenaBattles(storeFile) });
  });

  router.post("/battle", (req, res) => {
    try {
      const battle = createArenaBattle(req.body, storeFile);
      res.status(201).json({ success: true, battle });
    } catch (err: any) {
      const status = err instanceof ArenaLoopValidationError ? err.statusCode : 500;
      res.status(status).json({ success: false, error: err.message || "Failed to create Arena Loop battle." });
    }
  });

  router.get("/battle/:id", (req, res) => {
    const battle = findArenaBattle(req.params.id, storeFile);
    if (!battle) {
      res.status(404).json({ success: false, error: "Arena Loop battle was not found." });
      return;
    }
    res.json({ success: true, battle });
  });

  router.patch("/battle/:id", (req, res) => {
    try {
      const battle = findArenaBattle(req.params.id, storeFile);
      if (!battle) {
        res.status(404).json({ success: false, error: "Arena Loop battle was not found." });
        return;
      }
      const nextBattle = updateArenaBattle(updateArenaBattleGoal(battle, req.body || {}), storeFile);
      res.json({ success: true, battle: nextBattle });
    } catch (err: any) {
      const status = err instanceof ArenaLoopValidationError ? err.statusCode : 500;
      res.status(status).json({ success: false, error: err.message || "Failed to update Arena Loop battle." });
    }
  });

  router.post("/battle/:id/turn", async (req, res) => {
    try {
      const battle = findArenaBattle(req.params.id, storeFile);
      if (!battle) {
        res.status(404).json({ success: false, error: "Arena Loop battle was not found." });
        return;
      }
      const side = req.body?.side === "agentB" ? "agentB" : "agentA";
      const nextBattle = updateArenaBattle(await runArenaBattleTurnWithSearch(battle, side), storeFile);
      res.json({
        success: true,
        battle: nextBattle,
        turn: nextBattle.turns[nextBattle.turns.length - 1],
        argument: nextBattle.arguments[nextBattle.arguments.length - 1],
      });
    } catch (err: any) {
      const status = err instanceof ArenaLoopValidationError ? err.statusCode : 500;
      res.status(status).json({ success: false, error: err.message || "Failed to run Arena Loop turn." });
    }
  });

  router.post("/battle/:id/turn/debate", (req, res) => {
    try {
      const battle = findArenaBattle(req.params.id, storeFile);
      if (!battle) {
        res.status(404).json({ success: false, error: "Arena Loop battle was not found." });
        return;
      }
      const side = req.body?.side === "agentB" ? "agentB" : "agentA";
      const nextBattle = updateArenaBattle(appendArenaBattleTurn(battle, req.body?.turn || {}, side, {
        latencyMs: req.body?.latencyMs,
        promptContextSnapshot: req.body?.promptContextSnapshot,
        provider: req.body?.provider,
        model: req.body?.model,
        providerMetadata: req.body?.providerMetadata,
        complete: Boolean(req.body?.complete),
      }), storeFile);
      res.json({
        success: true,
        battle: nextBattle,
        turn: nextBattle.turns[nextBattle.turns.length - 1],
        argument: nextBattle.arguments[nextBattle.arguments.length - 1],
      });
    } catch (err: any) {
      const status = err instanceof ArenaLoopValidationError ? err.statusCode : 500;
      res.status(status).json({ success: false, error: err.message || "Failed to append Arena Loop debate turn." });
    }
  });

  router.get("/battle/:id/export/jsonl", (req, res) => {
    const battle = findArenaBattle(req.params.id, storeFile);
    if (!battle) {
      res.status(404).json({ success: false, error: "Arena Loop battle was not found." });
      return;
    }
    res.json({ success: true, export: buildArenaBattleJsonlExport(battle) });
  });

  router.get("/battle/:id/export/research-bundle.zip", (req, res) => {
    const battle = findArenaBattle(req.params.id, storeFile);
    if (!battle) {
      res.status(404).json({ success: false, error: "Arena Loop battle was not found." });
      return;
    }
    const zip = buildArenaBattleResearchBundleZip(battle);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="arena-loop-battle-${battle.slug || battle.id}-research-bundle.zip"`);
    res.send(zip);
  });

  router.get("/battle/:id/replay", (req, res) => {
    const battle = findArenaBattle(req.params.id, storeFile);
    if (!battle) {
      res.status(404).json({ success: false, error: "Arena Loop battle was not found." });
      return;
    }
    res.json({ success: true, battleId: battle.id, replay: reconstructArenaBattleReplay(battle) });
  });

  return router;
}
