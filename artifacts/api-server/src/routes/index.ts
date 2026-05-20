import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";

const router: IRouter = Router();

router.use("/healthz", healthRouter);
router.use("/userauth", authRouter);

export default router;
