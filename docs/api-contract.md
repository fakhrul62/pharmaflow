# Shared API contract

API base `/api`. JSON. Cookie authentication. Errors `{message: string | string[], statusCode?: number}`. IDs strings, date-only ISO strings, timestamp ISO strings. All prices and amounts in **integer cents**, all quantities integers. Browser same-origin `/api` proxy. Web dev port 5173, API 3001.

`Entity = {id: string, [key: string]: any}`. Resource lists are plain entity arrays in bootstrap. Mutations return an entity (checkout returns a Sale entity). The UI invalidates bootstrap after mutation.

- `GET /auth/me` -> `{id,name,email,role}` or 401.
- `POST /auth/login` `{email,password}` -> user, sets session cookie.
- `POST /auth/logout` -> `{ok:true}` clears cookie.
- `PATCH /auth/password` `{currentPassword,newPassword}` -> `{ok:true}`.
- `GET /bootstrap` -> `{user, resources: Record<ResourceName, Entity[]>, settings: Settings}`. Omit staff/audit/finance data when role cannot access it. Limit bootstrap lists to reasonable sample/operational scale, resource API supports pagination for growth.
- `GET /resources/:resource?q=&page=1&limit=25` -> `{items,total,page,limit}`.
- `POST /resources/:resource` -> Entity. Body fields defined below.
- `PATCH /resources/:resource/:id` -> Entity; same fields, partial.
- `DELETE /resources/:resource/:id` -> `{ok:true}`; reject linked records that cannot be safely deleted.
- `PATCH /settings` partial Settings -> Settings.
- `POST /operations/checkout` `{items:[{medicineId,quantity}],customerId?:string,discount:number,paymentMethod:'cash'|'card'|'mobile'|'bank-transfer',amountPaid:number,prescriptionId?:string,idempotencyKey:string}` -> Sale. Unit prices from backend, FEFO eligible active unexpired batches, stock + movements + sale + payment atomic. Discount is cents, cannot exceed subtotal. Insufficient amountPaid creates partial/unpaid balance; cash UI requires full payment. Prescription-required items require verified matching prescription; dispensing cannot exceed prescribed amount. Controlled items pharmacist/admin only.
- `POST /operations/receive` `{purchaseId,idempotencyKey}` -> purchase. Receives each line's quantity into batch, updates stock, marks received; reject repeat.
- `POST /operations/adjust` `{medicineId,batchId,quantityChange,reason}` -> adjustment. Quantity cannot result in negative stock.
- `POST /operations/transfer` `{batchId,quantity,destination,reason}` -> transfer. Moves quantity between location-specific batch records without changing total stock.
- `POST /operations/sales-return` `{saleId,reason,restock:boolean,idempotencyKey}` -> return. Full sale return once, refund outstanding/payment correctly; restock only unexpired eligible original batches, otherwise quarantine.
- `POST /operations/purchase-return` `{purchaseId,reason,idempotencyKey}` -> return. Full received purchase return once if remaining stock sufficient.
- `POST /operations/verify-prescription` `{prescriptionId}` -> prescription; pharmacist/admin only.
- `POST /operations/mark-notification` `{id}` -> notification.
- `POST /operations/cash-register` `{action:'open'|'close',amount:number}` -> register.

## Resources and frontend fields

- `medicines`: name, genericName, sku, barcode, categoryId, brandId, strength, dosageForm, unit, purchasePrice, sellingPrice, reorderLevel, requiresPrescription:boolean, isControlled:boolean, status:'active'|'inactive', image?, location?. Derived `currentStock`. Creating medicine with openingStock optional creates initial batch using expiryDate and batchNumber; frontend sends via initial batch resource instead.
- `batches`: medicineId,batchNumber,expiryDate,manufacturingDate?,quantity,purchasePrice,sellingPrice,location,status:'active'|'quarantined'|'expired',supplierId?. Quantity on create creates stock movement; updates cannot arbitrarily change quantity (use adjustment).
- `categories`: name,description.
- `brands`: name,manufacturer,description.
- `units`: name,abbreviation.
- `suppliers`: name,contactPerson,email,phone,address,paymentTerms,status.
- `customers`: name,email,phone,address,groupId?,status; derived outstandingBalance,totalPurchases.
- `customer-groups`: name,discountPercentage,description.
- `sales`: invoiceNumber,customerId?,customerName,items:[{medicineId,medicineName,batchId,batchNumber,quantity,unitPrice,total}],subtotal,discount,tax,total,amountPaid,paymentMethod,paymentStatus,status,createdAt. Read-only; checkout/return only.
- `sales-returns`: saleId,reference,reason,total,restock,status,createdAt. Read-only operation output.
- `quotations`: reference,customerId?,customerName,items:[{medicineId,quantity,unitPrice}],total,status:'draft'|'sent'|'accepted'|'expired',validUntil,notes. Server computes totals, no stock effects.
- `purchases`: reference,supplierId,items:[{medicineId,quantity,unitPrice,batchNumber,expiryDate,location}],total,status:'ordered'|'received'|'returned',paymentStatus:'unpaid'|'paid',expectedDate,notes. Creates ordered purchase, receive via operation only. Server computes total.
- `purchase-returns`: purchaseId,reference,reason,total,status,createdAt. Read-only operation output.
- `prescriptions`: reference,customerId,prescriberName,prescriberLicense,date,expiryDate,items:[{medicineId,quantity,dosage,dispensedQuantity?}],status:'pending'|'verified'|'dispensed'|'rejected',notes.
- `expenses`: title,category,amount,date,paymentMethod,notes.
- `income`: title,category,amount,date,paymentMethod,notes. Manual non-sales income only.
- `payments`: reference,type:'incoming'|'outgoing',amount,paymentMethod,status,relatedId?,date,notes. May create manual settlement only if linked sale/purchase is reconciled, or record unlinked other payments explicitly.
- `cash-registers`: cashierName,openingBalance,closingBalance?,expectedBalance,status,openedAt,closedAt. Read-only operation output.
- `staff`: name,email,role:'admin'|'pharmacist'|'cashier',status:'active'|'inactive',password? (write-only). Last active admin cannot be disabled/demoted/deleted. Password minimum 10 characters.
- `roles`: name,description,permissions:string[]. Read-only predefined roles map permissions enforced by backend.
- `notifications`: title,message,type:'warning'|'info'|'success',isRead,link,createdAt.
- `movements`: medicineId,batchId,type,quantity,reason,reference,createdAt. Read-only.
- `adjustments`: medicineId,batchId,quantityChange,reason,createdAt. Read-only.
- `transfers`: medicineId,batchId,quantity,source,destination,reason,createdAt. Read-only.
- `audit`: action,resource,recordId,userName,createdAt. Admin read-only; never expose password/token material.

Settings: `{pharmacyName,address,phone,email,currency,timezone,invoicePrefix,receiptFooter,taxRate:number,lowStockAlerts:boolean,expiryAlerts:boolean,expiryWarningDays:number,theme:'light'|'dark'|'system'}`. Defaults USD, Asia/Dhaka, taxRate 0. Settings tax rate is percent, backend computes in cents. No implied tax/legal compliance.

## Permissions

Admin: all. Pharmacist: operational pharmacy resources, finance read, settings read; cannot manage staff or system settings. Cashier: medicines/categories/brands/units/batches/customers/groups/sales/quotations/prescriptions read, customers create/update, checkout own sales/register operations; no purchasing/stock writes, prescription verification, finance/staff/settings writes. Bootstrap should provide only authorized resources; UI hides restricted routes and actions, server enforces.

## Local seed

Admin email `admin@pharmaflow.local`, password `PharmaFlow!2026`. Local demo only; production boot refuses these credentials. Provide pharmacist/cashier demo accounts with same local password for permission verification. Include dynamic-date sample batches (some low stock, some expiring, some expired), sales, purchases, expenses and prescriptions. Use reference fixture medicine names and available product assets where useful.
