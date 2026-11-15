import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaClient, Prisma } from "@prisma/client";
import { randomUUID, createHash } from "node:crypto";
import * as argon2 from "argon2";
import {
  schemas,
  operations,
  defaults,
  settingsSchema,
  resourceNames,
  cashierReads,
  readonlyResources,
} from "./validation";
export const prisma = new PrismaClient();
export type Entity = {
  id: string;
  [key: string]: any;
};
export type Actor = {
  id: string;
  name: string;
  email: string;
  role: string;
  status?: string;
};
const now = () => new Date().toISOString();
export const today = (timezone = "Asia/Dhaka", instant = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(instant);
const publicUser = (u: any): Actor => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  status: u.status,
});
export function parse(schema: any, body: any): any {
  const r = schema.safeParse(body);
  if (!r.success)
    throw new BadRequestException(
      r.error.issues.map((e: any) => `${e.path.join(".")}: ${e.message}`),
    );
  return r.data;
}
function parsePartial(schema: any, body: any): any {
  const parsed = parse(schema.partial(), body);
  return Object.fromEntries(Object.keys(body).map((key) => [key, parsed[key]]));
}
export class Store {
  records: Record<string, Entity[]> = {};
  constructor(public tx: Prisma.TransactionClient) {}
  businessDate = today();
  async load() {
    const setting = await this.tx.setting.findUnique({
      where: { id: "default" },
    });
    this.businessDate = today(
      (setting?.data as any)?.timezone ?? defaults.timezone,
    );
    for (const r of await this.tx.record.findMany())
      (this.records[r.resource] ??= []).push({ ...(r.data as any), id: r.id });
  }
  all(r: string) {
    return (this.records[r] ??= []);
  }
  get(r: string, id: string): Entity {
    const e = this.all(r).find((e) => e.id === id);
    if (!e) throw new BadRequestException(`${r} record does not exist`);
    return e;
  }
  async put(r: string, e: any) {
    const v = JSON.parse(JSON.stringify({ ...e, id: e.id ?? randomUUID() }));
    await this.tx.record.upsert({
      where: { id: v.id },
      create: { id: v.id, resource: r, data: v },
      update: { data: v },
    });
    const a = this.all(r),
      i = a.findIndex((x) => x.id === v.id);
    if (i < 0) a.push(v);
    else a[i] = v;
    return v;
  }
  async add(r: string, e: any) {
    return this.put(r, {
      ...e,
      id: randomUUID(),
      createdAt: e.createdAt ?? now(),
    });
  }
  async remove(r: string, id: string) {
    await this.tx.record.delete({ where: { id } });
    this.records[r] = this.all(r).filter((e) => e.id !== id);
  }
  async movement(
    batch: Entity,
    quantity: number,
    type: string,
    reason: string,
    reference: string,
  ) {
    await this.add("movements", {
      medicineId: batch.medicineId,
      batchId: batch.id,
      quantity,
      type,
      reason,
      reference,
    });
  }
}
@Injectable()
export class PharmacyService {
  async transaction<T>(fn: (s: Store) => Promise<T>) {
    return prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(724839201)`;
        const s = new Store(tx);
        await s.load();
        return fn(s);
      },
      { maxWait: 15000, timeout: 30000 },
    );
  }
  canRead(user: Actor, r: string) {
    return (
      resourceNames.includes(r) &&
      (user.role === "admin" ||
        (user.role === "pharmacist" &&
          !["staff", "audit", "roles"].includes(r)) ||
        (user.role === "cashier" && cashierReads.includes(r)))
    );
  }
  assertRead(u: Actor, r: string) {
    if (!this.canRead(u, r))
      throw new ForbiddenException("Resource access denied");
  }
  assertWrite(u: Actor, r: string) {
    if (readonlyResources.includes(r) || !schemas[r])
      throw new ForbiddenException("Use the dedicated operation");
    if (u.role === "admin") return;
    if (
      u.role === "pharmacist" &&
      !["staff", "expenses", "income", "payments"].includes(r)
    )
      return;
    if (u.role === "cashier" && r === "customers") return;
    throw new ForbiddenException("Write access denied");
  }
  async settings(tx: any = prisma) {
    const r = await tx.setting.findUnique({ where: { id: "default" } });
    return r?.data ?? defaults;
  }
  async list(u: Actor, r: string, ids?: string[]) {
    this.assertRead(u, r);
    if (r === "staff")
      return (await prisma.user.findMany({ orderBy: { name: "asc" } })).map(
        publicUser,
      );
    if (r === "roles")
      return ["admin", "pharmacist", "cashier"].map((name) => ({
        id: name,
        name,
        description: `${name} system role`,
        permissions:
          name === "admin"
            ? ["all"]
            : name === "pharmacist"
              ? ["pharmacy:write", "finance:read", "settings:read"]
              : ["checkout", "customers:write", "register:own"],
      }));
    const rows = (
      await prisma.record.findMany({
        where: { resource: r, ...(ids ? { id: { in: ids } } : {}) },
        orderBy: { createdAt: "desc" },
      })
    ).map((x) => ({ ...(x.data as any), id: x.id }));
    let result = rows;
    if (u.role === "cashier" && ["sales", "cash-registers"].includes(r))
      result = result.filter((e) => e.userId === u.id);
    if (r === "medicines") {
      const businessDate = today(((await this.settings()) as any).timezone);
      const batches = (
        await prisma.record.findMany({ where: { resource: "batches" } })
      ).map((x) => x.data as any);
      result = result.map((e) => ({
        ...e,
        currentStock: batches
          .filter(
            (b) =>
              b.medicineId === e.id &&
              b.status === "active" &&
              b.expiryDate > businessDate,
          )
          .reduce((n, b) => n + b.quantity, 0),
      }));
    }
    if (r === "customers") {
      const sales = (
        await prisma.record.findMany({ where: { resource: "sales" } })
      ).map((x) => x.data as any);
      result = result.map((e) => ({
        ...e,
        totalPurchases: sales
          .filter((s) => s.customerId === e.id && s.status !== "returned")
          .reduce((n, s) => n + s.total, 0),
        outstandingBalance: sales
          .filter((s) => s.customerId === e.id && s.status !== "returned")
          .reduce((n, s) => n + s.total - s.amountPaid, 0),
      }));
    }
    return result;
  }
  async paginate(
    u: Actor,
    resource: string,
    q: string | undefined,
    page: number,
    limit: number,
  ) {
    this.assertRead(u, resource);
    if (["staff", "roles"].includes(resource)) {
      const items = (await this.list(u, resource)).filter(
        (e) => !q || JSON.stringify(e).toLowerCase().includes(q.toLowerCase()),
      );
      return {
        items: items.slice((page - 1) * limit, page * limit),
        total: items.length,
        page,
        limit,
      };
    }
    const owner =
      u.role === "cashier" && ["sales", "cash-registers"].includes(resource)
        ? u.id
        : null;
    const search = `%${(q ?? "").replace(/[\\%_]/g, "\\$&")}%`;
    const count = await prisma.$queryRaw<
      { total: bigint }[]
    >`SELECT COUNT(*) AS total FROM "Record" WHERE "resource" = ${resource} AND "data"::text ILIKE ${search} AND (${owner}::text IS NULL OR "data"->>'userId' = ${owner})`;
    const ids = await prisma.$queryRaw<
      { id: string }[]
    >`SELECT "id" FROM "Record" WHERE "resource" = ${resource} AND "data"::text ILIKE ${search} AND (${owner}::text IS NULL OR "data"->>'userId' = ${owner}) ORDER BY "createdAt" DESC, "id" LIMIT ${limit} OFFSET ${(page - 1) * limit}`;
    return {
      items: await this.list(
        u,
        resource,
        ids.map((row) => row.id),
      ),
      total: Number(count[0].total),
      page,
      limit,
    };
  }
  async bootstrap(u: Actor) {
    const resources: Record<string, any[]> = {};
    await Promise.all(
      resourceNames
        .filter((r) => this.canRead(u, r))
        .map(async (r) => (resources[r] = await this.list(u, r))),
    );
    return { user: publicUser(u), resources, settings: await this.settings() };
  }
  async audit(
    s: Store,
    u: Actor,
    action: string,
    resource: string,
    recordId: string,
  ) {
    await s.add("audit", { action, resource, recordId, userName: u.name });
  }
  async validateRefs(s: Store, r: string, e: any) {
    for (const [field, target] of Object.entries({
      categoryId: "categories",
      brandId: "brands",
      supplierId: "suppliers",
      customerId: "customers",
      groupId: "customer-groups",
      medicineId: "medicines",
    })) {
      if (e[field]) s.get(target, e[field]);
    }
    if (e.items)
      for (const item of e.items) s.get("medicines", item.medicineId);
    if (
      r === "medicines" &&
      s
        .all(r)
        .some(
          (x) =>
            x.id !== e.id &&
            (x.sku === e.sku || (e.barcode && x.barcode === e.barcode)),
        )
    )
      throw new BadRequestException("SKU and barcode must be unique");
    if (r === "batches") {
      if (e.manufacturingDate && e.manufacturingDate >= e.expiryDate)
        throw new BadRequestException("Manufacturing date must precede expiry");
      if (
        s
          .all(r)
          .some(
            (x) =>
              x.id !== e.id &&
              x.medicineId === e.medicineId &&
              x.batchNumber === e.batchNumber &&
              x.location === e.location,
          )
      )
        throw new BadRequestException("Batch already exists at location");
    }
    if (r === "prescriptions") {
      if (e.expiryDate < e.date)
        throw new BadRequestException("Prescription expiry precedes date");
      if (
        new Set(e.items.map((i: any) => i.medicineId)).size !== e.items.length
      )
        throw new BadRequestException("Duplicate prescription medicine");
    }
  }
  async mutate(u: Actor, r: string, body: any, id?: string) {
    this.assertWrite(u, r);
    return this.transaction(async (s) => {
      if (r === "staff") return this.staff(s, u, body, id);
      const old = id ? s.get(r, id) : undefined;
      const e = id ? parsePartial(schemas[r], body) : parse(schemas[r], body);
      if (
        old &&
        r === "purchases" &&
        (("paymentStatus" in e && e.paymentStatus !== old.paymentStatus) ||
          old.paymentStatus === "paid")
      )
        throw new BadRequestException(
          "Use payment settlements; paid purchases cannot be edited",
        );
      if (id && r === "batches" && "quantity" in e)
        throw new BadRequestException(
          "Use stock adjustment to change quantity",
        );
      if (
        old &&
        ["purchases", "prescriptions"].includes(r) &&
        ((old.status !== "ordered" && r === "purchases") ||
          old.status === "dispensed" ||
          old.status === "verified")
      )
        throw new BadRequestException("Finalized document cannot be edited");
      if (
        old &&
        r === "batches" &&
        [
          "medicineId",
          "batchNumber",
          "expiryDate",
          "manufacturingDate",
          "location",
        ].some((field) => field in e && e[field] !== old[field])
      )
        throw new BadRequestException(
          "Batch identity is immutable; use transfer for location changes",
        );
      if (
        old &&
        ["expenses", "income"].includes(r) &&
        ["amount", "paymentMethod", "date"].some(
          (field) => field in e && e[field] !== old[field],
        )
      )
        throw new BadRequestException(
          "Posted finance amounts, methods and dates are immutable; create explicit correction entries",
        );
      const merged = { ...old, ...e, ...(id ? { id } : {}) };
      await this.validateRefs(s, r, merged);
      if (["purchases", "quotations"].includes(r)) {
        merged.total = merged.items.reduce(
          (a: number, i: any) => a + i.quantity * i.unitPrice,
          0,
        );
        merged.reference ??= `${r === "purchases" ? "PO" : "QUO"}-${Date.now()}-${randomUUID().slice(0, 4)}`;
      }
      if (merged.total !== undefined && !Number.isSafeInteger(merged.total))
        throw new BadRequestException("Total exceeds supported range");
      if (r === "prescriptions") {
        merged.reference ??= `RX-${Date.now()}`;
        merged.items = merged.items.map((i: any) => ({
          ...i,
          dispensedQuantity: 0,
        }));
      }
      if (r === "payments") {
        if (id) throw new BadRequestException("Payments are immutable");
        if (merged.relatedId) {
          const target = merged.type === "incoming" ? "sales" : "purchases";
          const doc = s.get(target, merged.relatedId);
          if (target === "sales") {
            if (
              doc.status === "returned" ||
              merged.amount > doc.total - doc.amountPaid
            )
              throw new BadRequestException(
                "Payment exceeds outstanding balance",
              );
            doc.amountPaid += merged.amount;
            doc.paymentStatus =
              doc.amountPaid === doc.total ? "paid" : "partial";
            await s.put(target, doc);
          } else {
            if (
              doc.paymentStatus === "paid" ||
              doc.status === "returned" ||
              merged.amount !== doc.total
            )
              throw new BadRequestException(
                "Purchase settlement must equal unpaid total",
              );
            await s.put(target, { ...doc, paymentStatus: "paid" });
          }
        } else if (!merged.notes)
          throw new BadRequestException("Describe unlinked payment in notes");
        merged.reference ??= `PAY-${Date.now()}`;
      }
      const result = id ? await s.put(r, merged) : await s.add(r, merged);
      if (r === "purchases" && !id && result.paymentStatus === "paid")
        await this.payment(
          s,
          "outgoing",
          result.total,
          "bank-transfer",
          result.id,
          "Purchase payment",
        );
      if (r === "batches" && !id)
        await s.movement(
          result,
          result.quantity,
          "opening",
          "Opening stock",
          result.id,
        );
      if (!old && ["payments", "expenses", "income"].includes(r)) {
        const sign =
          r === "expenses" || (r === "payments" && result.type === "outgoing")
            ? -1
            : 1;
        result.cashRegisterId = await this.registerCash(
          s,
          u,
          result.paymentMethod,
          sign * result.amount,
        );
        await s.put(r, result);
      }
      await this.audit(s, u, id ? "update" : "create", r, result.id);
      return result;
    });
  }
  async staff(s: Store, u: Actor, body: any, id?: string) {
    const data = id
      ? parsePartial(schemas.staff, body)
      : parse(schemas.staff, body);
    if (
      process.env.NODE_ENV === "production" &&
      data.password === "PharmaFlow!2026"
    )
      throw new BadRequestException("Demo passwords are not allowed");
    const old = id ? await s.tx.user.findUnique({ where: { id } }) : null;
    if (id && !old) throw new NotFoundException();
    if (
      old?.role === "admin" &&
      old.status === "active" &&
      ((data.role && data.role !== "admin") || data.status === "inactive") &&
      (await s.tx.user.count({ where: { role: "admin", status: "active" } })) <=
        1
    )
      throw new BadRequestException("Keep at least one active admin");
    if (!id && !data.password)
      throw new BadRequestException("Password is required");
    const { password, ...fields } = data;
    const record = id
      ? await s.tx.user.update({
          where: { id },
          data: {
            ...fields,
            ...(password ? { passwordHash: await argon2.hash(password) } : {}),
          },
        })
      : await s.tx.user.create({
          data: { ...fields, passwordHash: await argon2.hash(password) },
        });
    if (password || data.status === "inactive" || data.role)
      await s.tx.session.deleteMany({ where: { userId: record.id } });
    await this.audit(s, u, id ? "update" : "create", "staff", record.id);
    return publicUser(record);
  }
  async delete(u: Actor, r: string, id: string) {
    if (u.role === "cashier")
      throw new ForbiddenException(
        "Customer deletion requires pharmacist or administrator",
      );
    this.assertWrite(u, r);
    return this.transaction(async (s) => {
      if (r === "staff") {
        const old = await s.tx.user.findUnique({ where: { id } });
        if (!old) throw new NotFoundException();
        if (
          old.role === "admin" &&
          old.status === "active" &&
          (await s.tx.user.count({
            where: { role: "admin", status: "active" },
          })) <= 1
        )
          throw new BadRequestException("Keep at least one active admin");
        if (s.all("sales").some((e) => e.userId === id))
          throw new BadRequestException(
            "Staff has linked sales; deactivate instead",
          );
        await s.tx.user.delete({ where: { id } });
      } else {
        const old = s.get(r, id);
        if (["payments", "expenses", "income"].includes(r))
          throw new BadRequestException("Financial records cannot be deleted");
        if (r === "batches" && old.quantity !== 0)
          throw new BadRequestException("Batch still holds stock");
        if (
          (r === "purchases" && old.status !== "ordered") ||
          (r === "prescriptions" && old.status !== "pending")
        )
          throw new BadRequestException("Finalized record cannot be deleted");
        const fields = [
          "medicineId",
          "categoryId",
          "brandId",
          "supplierId",
          "customerId",
          "groupId",
          "batchId",
          "saleId",
          "purchaseId",
          "prescriptionId",
          "relatedId",
        ];
        for (const [resource, rows] of Object.entries(s.records)) {
          if (resource === "audit") continue;
          for (const row of rows) {
            if (row.id === id) continue;
            if (
              fields.some((f) => row[f] === id) ||
              (row.items ?? []).some((i: any) =>
                fields.some((f) => i[f] === id),
              )
            )
              throw new BadRequestException(
                "Record is linked; archive or deactivate instead",
              );
          }
        }
        await s.remove(r, id);
      }
      await this.audit(s, u, "delete", r, id);
      return { ok: true };
    });
  }
  async updateSettings(u: Actor, body: any) {
    if (u.role !== "admin") throw new ForbiddenException();
    const data = parsePartial(settingsSchema, body);
    return this.transaction(async (s) => {
      const merged = { ...((await this.settings(s.tx)) as any), ...data };
      await s.tx.setting.upsert({
        where: { id: "default" },
        create: { id: "default", data: merged },
        update: { data: merged },
      });
      await this.audit(s, u, "update", "settings", "default");
      return merged;
    });
  }
  async operation(u: Actor, op: string, body: any) {
    if (!operations[op]) throw new NotFoundException("Unknown operation");
    if (
      u.role === "cashier" &&
      !["checkout", "cash-register", "mark-notification"].includes(op)
    )
      throw new ForbiddenException();
    const b = parse(operations[op], body);
    return this.transaction(async (s) => {
      const hash = createHash("sha256").update(JSON.stringify(b)).digest("hex");
      const key = b.idempotencyKey ? `${u.id}:${b.idempotencyKey}` : undefined;
      if (key) {
        const existing = await s.tx.idempotency.findUnique({ where: { key } });
        if (existing) {
          if (existing.operation !== op || existing.requestHash !== hash)
            throw new BadRequestException(
              "Idempotency key already used for a different request",
            );
          return existing.result;
        }
      }
      let result: Entity;
      if (op === "checkout") result = await this.checkout(s, u, b);
      else if (op === "receive") result = await this.receive(s, b);
      else if (op === "adjust") {
        const batch = s.get("batches", b.batchId);
        if (batch.medicineId !== b.medicineId)
          throw new BadRequestException("Batch does not match medicine");
        if (batch.quantity + b.quantityChange < 0)
          throw new BadRequestException("Insufficient stock");
        await s.put("batches", {
          ...batch,
          quantity: batch.quantity + b.quantityChange,
        });
        result = await s.add("adjustments", b);
        await s.movement(
          batch,
          b.quantityChange,
          "adjustment",
          b.reason,
          result.id,
        );
      } else if (op === "transfer") {
        const batch = s.get("batches", b.batchId);
        if (batch.quantity < b.quantity)
          throw new BadRequestException("Insufficient stock");
        if (batch.location === b.destination)
          throw new BadRequestException("Choose a different destination");
        let dest = s
          .all("batches")
          .find(
            (e) =>
              e.medicineId === batch.medicineId &&
              e.batchNumber === batch.batchNumber &&
              e.location === b.destination,
          );
        if (
          dest &&
          (dest.status !== batch.status || dest.expiryDate !== batch.expiryDate)
        )
          throw new BadRequestException("Destination batch is incompatible");
        await s.put("batches", {
          ...batch,
          quantity: batch.quantity - b.quantity,
        });
        dest = dest
          ? await s.put("batches", {
              ...dest,
              quantity: dest.quantity + b.quantity,
            })
          : await s.add("batches", {
              ...batch,
              id: undefined,
              quantity: b.quantity,
              location: b.destination,
            });
        result = await s.add("transfers", {
          ...b,
          medicineId: batch.medicineId,
          source: batch.location,
          destinationBatchId: dest!.id,
        });
        await s.movement(
          batch,
          -b.quantity,
          "transfer-out",
          b.reason,
          result.id,
        );
        await s.movement(dest!, b.quantity, "transfer-in", b.reason, result.id);
      } else if (op === "sales-return")
        result = await this.salesReturn(s, u, b);
      else if (op === "purchase-return")
        result = await this.purchaseReturn(s, u, b);
      else if (op === "verify-prescription") {
        const rx = s.get("prescriptions", b.prescriptionId);
        if (
          rx.status !== "pending" ||
          rx.expiryDate <= s.businessDate ||
          rx.date > s.businessDate
        )
          throw new BadRequestException(
            "Prescription is not valid for verification",
          );
        result = await s.put("prescriptions", {
          ...rx,
          status: "verified",
          verifiedBy: u.id,
          verifiedAt: now(),
        });
      } else if (op === "mark-notification")
        result = await s.put("notifications", {
          ...s.get("notifications", b.id),
          isRead: true,
        });
      else {
        const opened = s
          .all("cash-registers")
          .find((e) => e.userId === u.id && e.status === "open");
        if (b.action === "open") {
          if (opened)
            throw new BadRequestException("A register is already open");
          result = await s.add("cash-registers", {
            userId: u.id,
            cashierName: u.name,
            openingBalance: b.amount,
            expectedBalance: b.amount,
            status: "open",
            openedAt: now(),
          });
        } else {
          if (!opened) throw new BadRequestException("No register is open");
          result = await s.put("cash-registers", {
            ...opened,
            status: "closed",
            closingBalance: b.amount,
            closedAt: now(),
          });
        }
      }
      await this.audit(s, u, op, op, result.id);
      if (key)
        await s.tx.idempotency.create({
          data: {
            key,
            userId: u.id,
            operation: op,
            requestHash: hash,
            result: result as any,
          },
        });
      return result;
    });
  }
  async checkout(s: Store, u: Actor, b: any) {
    const settings = (await this.settings(s.tx)) as any;
    const quantities = new Map<string, number>();
    for (const i of b.items)
      quantities.set(
        i.medicineId,
        (quantities.get(i.medicineId) ?? 0) + i.quantity,
      );
    const customer = b.customerId
      ? s.get("customers", b.customerId)
      : undefined;
    if (customer?.status === "inactive")
      throw new BadRequestException("Customer is inactive");
    const rx = b.prescriptionId
      ? s.get("prescriptions", b.prescriptionId)
      : undefined;
    if (
      rx &&
      (rx.status !== "verified" ||
        rx.expiryDate <= s.businessDate ||
        rx.date > s.businessDate ||
        rx.customerId !== b.customerId)
    )
      throw new BadRequestException(
        "Supplied prescription must already be verified, valid and match the customer",
      );
    let consumedPrescription = false;
    const items: any[] = [];
    for (const [medicineId, quantity] of quantities) {
      const med = s.get("medicines", medicineId);
      if (med.status !== "active")
        throw new BadRequestException("Medicine is inactive");
      if (med.isControlled && u.role === "cashier")
        throw new ForbiddenException(
          "Controlled medicine requires a pharmacist",
        );
      if (med.requiresPrescription || med.isControlled) {
        if (
          !rx ||
          rx.status !== "verified" ||
          rx.expiryDate <= s.businessDate ||
          rx.date > s.businessDate ||
          rx.customerId !== b.customerId
        )
          throw new BadRequestException(
            "A valid verified matching prescription is required",
          );
        const line = rx.items.find((i: any) => i.medicineId === medicineId);
        if (!line || quantity > line.quantity - (line.dispensedQuantity ?? 0))
          throw new BadRequestException(
            "Quantity exceeds remaining prescription",
          );
        line.dispensedQuantity = (line.dispensedQuantity ?? 0) + quantity;
        consumedPrescription = true;
      }
      const batches = s
        .all("batches")
        .filter(
          (e) =>
            e.medicineId === medicineId &&
            e.status === "active" &&
            e.expiryDate > s.businessDate &&
            e.quantity > 0,
        )
        .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
      if (batches.reduce((n, e) => n + e.quantity, 0) < quantity)
        throw new BadRequestException(
          `Insufficient eligible stock for ${med.name}`,
        );
      let remaining = quantity;
      for (const batch of batches) {
        if (!remaining) break;
        const take = Math.min(batch.quantity, remaining);
        remaining -= take;
        await s.put("batches", { ...batch, quantity: batch.quantity - take });
        items.push({
          medicineId,
          medicineName: med.name,
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          quantity: take,
          unitPrice: med.sellingPrice,
          costPrice: batch.purchasePrice,
          total: take * med.sellingPrice,
        });
      }
    }
    const subtotal = items.reduce((n, i) => n + i.total, 0);
    if (!Number.isSafeInteger(subtotal))
      throw new BadRequestException("Total exceeds supported range");
    if (b.discount > subtotal)
      throw new BadRequestException("Discount exceeds subtotal");
    const tax = Math.round(((subtotal - b.discount) * settings.taxRate) / 100);
    const total = subtotal - b.discount + tax;
    if (b.amountPaid > total)
      throw new BadRequestException(
        "Amount paid cannot exceed total; enter amount applied after change",
      );
    if (b.paymentMethod === "cash" && b.amountPaid < total)
      throw new BadRequestException("Cash checkout requires full payment");
    if (b.amountPaid < total && !customer)
      throw new BadRequestException("A customer is required for credit sales");
    const sale = await s.add("sales", {
      invoiceNumber: `${settings.invoicePrefix}-${Date.now()}-${randomUUID().slice(0, 4)}`,
      customerId: b.customerId,
      customerName: customer?.name ?? "Walk-in customer",
      userId: u.id,
      cashierName: u.name,
      items,
      subtotal,
      discount: b.discount,
      tax,
      total,
      amountPaid: b.amountPaid,
      paymentMethod: b.paymentMethod,
      paymentStatus:
        b.amountPaid === total ? "paid" : b.amountPaid ? "partial" : "unpaid",
      status: "completed",
      prescriptionId: b.prescriptionId,
    });
    for (const item of items)
      await s.movement(
        s.get("batches", item.batchId),
        -item.quantity,
        "sale",
        "Checkout",
        sale.id,
      );
    if (rx && consumedPrescription) {
      rx.status = rx.items.every((i: any) => i.dispensedQuantity >= i.quantity)
        ? "dispensed"
        : "verified";
      await s.put("prescriptions", rx);
    }
    if (b.amountPaid)
      await this.payment(
        s,
        "incoming",
        b.amountPaid,
        b.paymentMethod,
        sale.id,
        "Sale payment",
        u,
      );
    return sale;
  }
  async payment(
    s: Store,
    type: string,
    amount: number,
    paymentMethod: string,
    relatedId: string,
    notes: string,
    actor?: Actor,
  ) {
    const cashRegisterId = actor
      ? await this.registerCash(
          s,
          actor,
          paymentMethod,
          type === "incoming" ? amount : -amount,
        )
      : undefined;
    return s.add("payments", {
      cashRegisterId,
      reference: `PAY-${Date.now()}-${randomUUID().slice(0, 4)}`,
      type,
      amount,
      paymentMethod,
      relatedId,
      date: s.businessDate,
      status: "completed",
      notes,
    });
  }
  async registerCash(s: Store, u: Actor, method: string, amount: number) {
    if (method !== "cash") return;
    const r = s
      .all("cash-registers")
      .find((e) => e.userId === u.id && e.status === "open");
    if (r)
      await s.put("cash-registers", {
        ...r,
        expectedBalance: r.expectedBalance + amount,
      });
    return r?.id;
  }
  async receive(s: Store, b: any) {
    const purchase = s.get("purchases", b.purchaseId);
    if (purchase.status !== "ordered")
      throw new BadRequestException("Purchase already received or returned");
    const items = [];
    for (const item of purchase.items) {
      if (item.expiryDate <= s.businessDate)
        throw new BadRequestException("Cannot receive expired stock");
      let batch = s
        .all("batches")
        .find(
          (e) =>
            e.medicineId === item.medicineId &&
            e.batchNumber === item.batchNumber &&
            e.location === item.location,
        );
      if (
        batch &&
        (batch.expiryDate !== item.expiryDate || batch.status !== "active")
      )
        throw new BadRequestException("Existing batch is incompatible");
      const med = s.get("medicines", item.medicineId);
      batch = batch
        ? await s.put("batches", {
            ...batch,
            quantity: batch.quantity + item.quantity,
          })
        : await s.add("batches", {
            medicineId: item.medicineId,
            batchNumber: item.batchNumber,
            expiryDate: item.expiryDate,
            quantity: item.quantity,
            purchasePrice: item.unitPrice,
            sellingPrice: med.sellingPrice,
            location: item.location,
            status: "active",
            supplierId: purchase.supplierId,
          });
      items.push({ ...item, batchId: batch!.id });
      await s.movement(
        batch!,
        item.quantity,
        "receive",
        "Purchase receipt",
        purchase.id,
      );
    }
    return s.put("purchases", {
      ...purchase,
      items,
      status: "received",
      receivedAt: now(),
    });
  }
  async salesReturn(s: Store, u: Actor, b: any) {
    const sale = s.get("sales", b.saleId);
    if (
      sale.status === "returned" ||
      s.all("sales-returns").some((e) => e.saleId === sale.id)
    )
      throw new BadRequestException("Sale already returned");
    for (const item of sale.items) {
      const batch = s.get("batches", item.batchId);
      if (b.restock) {
        if (batch.status === "active" && batch.expiryDate > s.businessDate) {
          await s.put("batches", {
            ...batch,
            quantity: batch.quantity + item.quantity,
          });
          await s.movement(
            batch,
            item.quantity,
            "sales-return",
            b.reason,
            sale.id,
          );
        } else {
          let quarantine = s
            .all("batches")
            .find(
              (e) =>
                e.originalBatchId === batch.id && e.status === "quarantined",
            );
          quarantine = quarantine
            ? await s.put("batches", {
                ...quarantine,
                quantity: quarantine.quantity + item.quantity,
              })
            : await s.add("batches", {
                ...batch,
                id: undefined,
                batchNumber: `${batch.batchNumber}-RETURN`,
                location: "Returns quarantine",
                status: "quarantined",
                originalBatchId: batch.id,
                quantity: item.quantity,
              });
          await s.movement(
            quarantine!,
            item.quantity,
            "sales-return-quarantine",
            b.reason,
            sale.id,
          );
        }
      }
    }
    await s.put("sales", {
      ...sale,
      status: "returned",
      paymentStatus: "refunded",
      refundedAmount: sale.amountPaid,
      amountPaid: 0,
    });
    await this.refundPayments(
      s,
      u,
      sale.id,
      "incoming",
      sale.amountPaid,
      "Sales return refund",
    );
    return s.add("sales-returns", {
      saleId: sale.id,
      reference: `SR-${Date.now()}`,
      reason: b.reason,
      total: sale.total,
      refundAmount: sale.amountPaid,
      cancelledBalance: sale.total - sale.amountPaid,
      restock: b.restock,
      status: "completed",
    });
  }
  async refundPayments(
    s: Store,
    u: Actor,
    relatedId: string,
    originalType: string,
    expected: number,
    notes: string,
  ) {
    const originals = s
      .all("payments")
      .filter(
        (p) =>
          p.relatedId === relatedId &&
          p.type === originalType &&
          p.status === "completed",
      );
    if (originals.reduce((sum, p) => sum + p.amount, 0) !== expected)
      throw new BadRequestException(
        "Payment history does not reconcile; resolve before returning",
      );
    const methods = new Map<string, number>();
    for (const p of originals)
      methods.set(
        p.paymentMethod,
        (methods.get(p.paymentMethod) ?? 0) + p.amount,
      );
    for (const [method, amount] of methods)
      await this.payment(
        s,
        originalType === "incoming" ? "outgoing" : "incoming",
        amount,
        method,
        relatedId,
        notes,
        u,
      );
  }
  async purchaseReturn(s: Store, u: Actor, b: any) {
    const purchase = s.get("purchases", b.purchaseId);
    if (purchase.status !== "received")
      throw new BadRequestException(
        "Only received purchases can be returned once",
      );
    for (const item of purchase.items) {
      const lots = s
        .all("batches")
        .filter(
          (batch) =>
            batch.medicineId === item.medicineId &&
            batch.batchNumber === item.batchNumber &&
            batch.expiryDate === item.expiryDate,
        );
      if (lots.reduce((sum, batch) => sum + batch.quantity, 0) < item.quantity)
        throw new BadRequestException("Insufficient stock to return purchase");
      let remaining = item.quantity;
      for (const batch of lots) {
        const take = Math.min(batch.quantity, remaining);
        if (!take) continue;
        remaining -= take;
        await s.put("batches", { ...batch, quantity: batch.quantity - take });
        await s.movement(
          batch,
          -take,
          "purchase-return",
          b.reason,
          purchase.id,
        );
      }
    }
    await s.put("purchases", {
      ...purchase,
      status: "returned",
      refundedAmount: purchase.paymentStatus === "paid" ? purchase.total : 0,
      cancelledBalance:
        purchase.paymentStatus === "unpaid" ? purchase.total : 0,
    });
    await this.refundPayments(
      s,
      u,
      purchase.id,
      "outgoing",
      purchase.paymentStatus === "paid" ? purchase.total : 0,
      "Supplier refund",
    );
    return s.add("purchase-returns", {
      purchaseId: purchase.id,
      reference: `PR-${Date.now()}`,
      reason: b.reason,
      total: purchase.total,
      status: "completed",
    });
  }
}
