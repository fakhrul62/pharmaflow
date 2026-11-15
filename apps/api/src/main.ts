import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import {
  Module,
  Inject,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
} from "@nestjs/common";
import express, { Request, Response } from "express";
import { resolve } from "node:path";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { randomBytes, createHash } from "node:crypto";
import * as argon2 from "argon2";
import { z } from "zod";
import { PharmacyService, prisma, parse } from "./pharmacy.service";
const tokenHash = (v: string) => createHash("sha256").update(v).digest("hex");
const cookie = "pharmaflow_session";
const cookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/api",
  maxAge: 8 * 60 * 60 * 1000,
};
@Injectable()
class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    if (req.method === "GET" && req.path === "/api/health") return true;
    if (req.method !== "GET" && req.method !== "HEAD") {
      const origin = req.headers.origin;
      const allowed = (process.env.APP_ORIGIN ?? "http://localhost:5173").split(
        ",",
      );
      if (!origin || !allowed.includes(origin))
        throw new ForbiddenException("Request origin is not allowed");
      if (
        Number(req.headers["content-length"] ?? 0) > 0 &&
        !req.is("application/json")
      )
        throw new ForbiddenException("JSON content type is required");
    }
    if (req.path === "/api/auth/login") return true;
    const token = req.cookies?.[cookie];
    if (!token) throw new UnauthorizedException("Please sign in");
    const session = await prisma.session.findUnique({
      where: { id: tokenHash(token) },
      include: { user: true },
    });
    if (
      !session ||
      session.expiresAt < new Date() ||
      session.user.status !== "active"
    )
      throw new UnauthorizedException("Session expired");
    req.user = {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
      status: session.user.status,
    };
    return true;
  }
}
@Catch()
class ErrorFilter implements ExceptionFilter {
  catch(e: any, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (e instanceof HttpException) {
      const v = e.getResponse();
      res
        .status(e.getStatus())
        .json(
          typeof v === "string" ? { message: v, statusCode: e.getStatus() } : v,
        );
      return;
    }
    if (e?.code === "P2002") {
      res
        .status(409)
        .json({ message: "A unique value is already in use", statusCode: 409 });
      return;
    }
    console.error("API request failed", e?.name, e?.code ?? "");
    res.status(500).json({
      message: "An unexpected server error occurred",
      statusCode: 500,
    });
  }
}
@Controller("api")
class ApiController {
  constructor(
    @Inject(PharmacyService)
    private service: PharmacyService,
  ) {}
  @Get("health")
  async health(@Res({ passthrough: true }) res: Response) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "ok", service: "pharmaflow-api" };
    } catch {
      res.status(503);
      return { status: "unavailable", service: "pharmaflow-api" };
    }
  }
  @Post("auth/login")
  async login(
    @Body()
    body: any,
    @Res({ passthrough: true })
    res: Response,
  ) {
    const b = parse(
      z
        .object({
          email: z
            .string()
            .email()
            .transform((s) => s.toLowerCase()),
          password: z.string().min(1).max(128),
        })
        .strict(),
      body,
    );
    const u = await prisma.user.findUnique({ where: { email: b.email } });
    if (
      !u ||
      u.status !== "active" ||
      !(await argon2.verify(u.passwordHash, b.password))
    )
      throw new UnauthorizedException("Invalid email or password");
    const token = randomBytes(32).toString("hex");
    await prisma.session.create({
      data: {
        id: tokenHash(token),
        userId: u.id,
        expiresAt: new Date(Date.now() + cookieOptions.maxAge),
      },
    });
    res.cookie(cookie, token, cookieOptions);
    return { id: u.id, name: u.name, email: u.email, role: u.role };
  }
  @Get("auth/me")
  me(
    @Req()
    req: any,
  ) {
    return req.user;
  }
  @Post("auth/logout")
  async logout(
    @Req()
    req: Request,
    @Res({ passthrough: true })
    res: Response,
  ) {
    await prisma.session.deleteMany({
      where: { id: tokenHash(req.cookies[cookie] ?? "") },
    });
    res.clearCookie(cookie, { ...cookieOptions, maxAge: undefined });
    return { ok: true };
  }
  @Patch("auth/password")
  async password(
    @Req()
    req: any,
    @Body()
    body: any,
  ) {
    const b = parse(
      z
        .object({
          currentPassword: z.string().max(128),
          newPassword: z.string().min(10).max(128),
        })
        .strict(),
      body,
    );
    const u = await prisma.user.findUniqueOrThrow({
      where: { id: req.user.id },
    });
    if (!(await argon2.verify(u.passwordHash, b.currentPassword)))
      throw new UnauthorizedException("Current password is incorrect");
    if (
      process.env.NODE_ENV === "production" &&
      b.newPassword === "PharmaFlow!2026"
    )
      throw new ForbiddenException("Demo passwords are not allowed");
    const hash = await argon2.hash(b.newPassword);
    await this.service.transaction(async (s) => {
      await s.tx.user.update({
        where: { id: u.id },
        data: { passwordHash: hash },
      });
      await s.tx.session.deleteMany({ where: { userId: u.id } });
      await this.service.audit(s, req.user, "password-change", "staff", u.id);
    });
    return { ok: true };
  }
  @Get("bootstrap")
  bootstrap(
    @Req()
    req: any,
  ) {
    return this.service.bootstrap(req.user);
  }
  @Get("resources/:resource")
  async list(
    @Req()
    req: any,
    @Param("resource")
    r: string,
    @Query()
    query: any,
  ) {
    const q = parse(
      z
        .object({
          q: z.string().max(200).optional(),
          page: z.coerce.number().int().min(1).default(1),
          limit: z.coerce.number().int().min(1).max(200).default(25),
        })
        .strict(),
      query,
    );
    return this.service.paginate(req.user, r, q.q, q.page, q.limit);
  }
  @Post("resources/:resource")
  create(
    @Req()
    req: any,
    @Param("resource")
    r: string,
    @Body()
    body: any,
  ) {
    return this.service.mutate(req.user, r, body);
  }
  @Patch("resources/:resource/:id")
  update(
    @Req()
    req: any,
    @Param("resource")
    r: string,
    @Param("id")
    id: string,
    @Body()
    body: any,
  ) {
    return this.service.mutate(req.user, r, body, id);
  }
  @Delete("resources/:resource/:id")
  remove(
    @Req()
    req: any,
    @Param("resource")
    r: string,
    @Param("id")
    id: string,
  ) {
    return this.service.delete(req.user, r, id);
  }
  @Patch("settings")
  settings(
    @Req()
    req: any,
    @Body()
    body: any,
  ) {
    return this.service.updateSettings(req.user, body);
  }
  @Post("operations/:operation")
  operation(
    @Req()
    req: any,
    @Param("operation")
    op: string,
    @Body()
    body: any,
  ) {
    return this.service.operation(req.user, op, body);
  }
}
@Module({ controllers: [ApiController], providers: [PharmacyService] })
class AppModule {}
export async function createApp() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  if (process.env.NODE_ENV === "production") {
    if (!process.env.APP_ORIGIN?.startsWith("https://"))
      throw new Error("Production requires an HTTPS APP_ORIGIN");
    for (const user of await prisma.user.findMany({
      where: { status: "active" },
    }))
      if (await argon2.verify(user.passwordHash, "PharmaFlow!2026"))
        throw new Error("Replace demo account passwords before production");
  }
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.use(cookieParser());
  // Correlate unexpected errors with platform logs without logging private payloads.
  app.use((req: Request, res: Response, next: () => void) => {
    const requestId = randomBytes(12).toString("hex");
    res.setHeader("X-Request-Id", requestId);
    res.on("finish", () => {
      if (res.statusCode >= 500)
        console.error(
          JSON.stringify({
            event: "http_error",
            requestId,
            method: req.method,
            path: req.path,
            status: res.statusCode,
          }),
        );
    });
    next();
  });
  if (process.env.SERVE_WEB === "true") {
    const directory = resolve(__dirname, "../../web/dist");
    app.use(express.static(directory));
    app.use((req: Request, res: Response, next: () => void) => {
      if (req.method === "GET" && !req.path.startsWith("/api"))
        return res.sendFile(resolve(directory, "index.html"));
      next();
    });
  }
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 600,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { message: "Too many requests" },
    }),
  );
  app.use(
    "/api/auth/login",
    rateLimit({
      windowMs: 15 * 60000,
      limit: 30,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { message: "Too many sign-in attempts" },
    }),
  );
  app.useGlobalGuards(new AuthGuard());
  app.useGlobalFilters(new ErrorFilter());
  return app;
}
if (require.main === module)
  createApp()
    .then((app) =>
      app.listen(
        Number(process.env.PORT ?? 3001),
        process.env.HOST ?? "127.0.0.1",
      ),
    )
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
