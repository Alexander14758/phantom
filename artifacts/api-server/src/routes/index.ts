import { Router, type IRouter } from "express";
import healthRouter from "./health";
import pricesRouter from "./prices";
import walletRouter from "./wallet";

const router: IRouter = Router();

router.use(healthRouter);
router.use(pricesRouter);
router.use(walletRouter);

export default router;
