import { Router, type IRouter } from "express";
import healthRouter from "./health";
import licenseRouter from "./license";
import voiceRouter from "./voice";
import memoryRouter from "./memory";
import appsRouter from "./apps";
import statsRouter from "./stats";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/license", licenseRouter);
router.use("/voice", voiceRouter);
router.use("/memory", memoryRouter);
router.use("/apps", appsRouter);
router.use("/stats", statsRouter);
router.use("/settings", settingsRouter);

export default router;
