import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import dashboardRouter from "./dashboard";
import strategiesRouter from "./strategies";
import positionsRouter from "./positions";
import depositsRouter from "./deposits";
import withdrawalsRouter from "./withdrawals";
import transactionsRouter from "./transactions";
import referralsRouter from "./referrals";
import notificationsRouter from "./notifications";
import paymentsRouter from "./payments";
import adminRouter from "./admin";
import dailyProfitRouter from "./daily-profit";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/dashboard", dashboardRouter);
router.use("/strategies", strategiesRouter);
router.use("/positions", positionsRouter);
router.use("/deposits", depositsRouter);
router.use("/withdrawals", withdrawalsRouter);
router.use("/transactions", transactionsRouter);
router.use("/referrals", referralsRouter);
router.use("/notifications", notificationsRouter);
router.use("/payments", paymentsRouter);
router.use("/admin/daily-profit", dailyProfitRouter);
router.use("/admin", adminRouter);

export default router;
