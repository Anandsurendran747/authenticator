const express = require("express");
const sheets = require("../Services/googleConnect");
const Sheets = require("../Models/Sheets");

const router = express.Router();

router.post("/", async (req, res) => {
    console.log("Backup request received:", req.body);
    try {
        const { user, bills = [], products = [] } = req.body;

        const userId = user?.id || user?._id || user?.userId || user?.user_id || req.user?.id;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "User identifier is required"
            });
        }

        const sheet = await Sheets.findOne({ userId });

        if (!sheet) {
            return res.status(404).json({
                success: false,
                message: "Sheet not found for the user"
            });
        }

        const spreadsheetId = sheet.sheetId;

        const ensureTab = async (tabName, headers) => {
            const existingSheet = await sheets.spreadsheets.get({ spreadsheetId });
            const sheetTitles = (existingSheet.data.sheets || []).map((sheet) => sheet.properties.title);

            if (!sheetTitles.includes(tabName)) {
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId,
                    requestBody: {
                        requests: [{
                            addSheet: { properties: { title: tabName } }
                        }]
                    }
                });
            }

            const lastCol = String.fromCharCode(64 + headers.length);
            const headerRow = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `${tabName}!A1:${lastCol}1`
            });

            const rowValues = (headerRow.data.values && headerRow.data.values[0]) || [];
            const hasHeaders = rowValues.some((cell) => cell && cell.toString().trim() !== "");

            if (!hasHeaders) {
                await sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: `${tabName}!A1`,
                    valueInputOption: "USER_ENTERED",
                    requestBody: { values: [headers] }
                });
            }
        };

        const billRows = Array.isArray(bills)
            ? bills.map((bill) => [
                bill.id || "",
                bill.billNo || "",
                bill.date || bill.createdAt || "",
                bill.time || "",
                bill.customerName || bill.customer || bill.client || "",
                bill.subtotal || bill.amount || bill.total || 0,
                bill.discount || 0,
                bill.gstRate || 0,
                bill.gst || 0,
                bill.total || bill.amount || 0,
                bill.paymentMode || bill.paymentMethod || bill.payment_method || "",
                parseFloat(bill.cashGiven) || 0,
                bill.backupStatus ?? false,
                // Store the entire items array as-is, JSON-encoded.
                // Leading apostrophe forces Sheets to treat it as plain text
                // (protects against edge cases where the JSON string could
                // otherwise be misread, e.g. if it were ever a bare number).
                `'${JSON.stringify(bill.items || [])}`
            ])
            : [];

        const productRows = Array.isArray(products)
            ? products.map((product) => [
                product.id || "",
                product.name || "",
                product.unit || 0,
                product.price || 0,
                product.category || "",
            ])
            : [];

        await ensureTab("Bills", ["id", "billNo", "date", "time", "customerName", "subtotal", "discount", "gstRate", "gst", "total", "paymentMode", "cashGiven", "backupStatus", "items"]);
        await ensureTab("Products", ["id", "name", "unit", "price", "category"]);

        const existingBillsResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: "Bills!A2:A"
        });

        const billIdToRow = {};
        (existingBillsResponse.data.values || []).forEach((row, idx) => {
            const id = row[0];
            if (id) billIdToRow[id] = idx + 2;
        });

        const billUpdates = [];
        const billAppends = [];

        billRows.forEach((row) => {
            const billId = row[0];
            if (billId && billIdToRow[billId]) {
                billUpdates.push(
                    sheets.spreadsheets.values.update({
                        spreadsheetId,
                        range: `Bills!A${billIdToRow[billId]}:N${billIdToRow[billId]}`,
                        valueInputOption: "USER_ENTERED",
                        requestBody: { values: [row] }
                    })
                );
            } else {
                billAppends.push(row);
            }
        });

        if (billUpdates.length > 0) await Promise.all(billUpdates);

        if (billAppends.length > 0) {
            await sheets.spreadsheets.values.append({
                spreadsheetId,
                range: "Bills!A:N",
                valueInputOption: "USER_ENTERED",
                requestBody: { values: billAppends }
            });
        }

        const existingProductsResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: "Products!A2:A"
        });

        const productIdToRow = {};
        (existingProductsResponse.data.values || []).forEach((row, idx) => {
            const id = row[0];
            if (id) productIdToRow[id] = idx + 2;
        });

        const productUpdates = [];
        const productAppends = [];

        productRows.forEach((row) => {
            const productId = row[0];
            if (productId && productIdToRow[productId]) {
                productUpdates.push(
                    sheets.spreadsheets.values.update({
                        spreadsheetId,
                        range: `Products!A${productIdToRow[productId]}:E${productIdToRow[productId]}`,
                        valueInputOption: "USER_ENTERED",
                        requestBody: { values: [row] }
                    })
                );
            } else {
                productAppends.push(row);
            }
        });

        if (productUpdates.length > 0) await Promise.all(productUpdates);

        if (productAppends.length > 0) {
            await sheets.spreadsheets.values.append({
                spreadsheetId,
                range: "Products!A:E",
                valueInputOption: "USER_ENTERED",
                requestBody: { values: productAppends }
            });
        }

        return res.json({
            success: true,
            message: "Bills and products saved"
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
});


router.get("/import", async (req, res) => {
    try {
        const userId = req.query.userId || req.user?.id;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "User identifier is required"
            });
        }

        const sheet = await Sheets.findOne({ userId });

        if (!sheet) {
            return res.status(404).json({
                success: false,
                message: "Sheet not found for the user"
            });
        }

        const spreadsheetId = sheet.sheetId;

        const billsResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: "Bills!A2:N"
        });

        const productsResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: "Products!A2:E"
        });

        const billRows = billsResponse.data.values || [];
        const productRows = productsResponse.data.values || [];

        const products = productRows.map(row => ({
            id: row[0] || "",
            name: row[1] || "",
            unit: row[2] || "",
            price: Number(row[3]) || 0,
            category: row[4] || ""
        }));

        const bills = billRows.map(row => {
            const [
                id,
                billNo,
                date,
                time,
                customerName,
                subtotal,
                discount,
                gstRate,
                gst,
                total,
                paymentMode,
                cashGiven,
                backupStatus,
                itemsRaw
            ] = row;

            // Strip the protective leading apostrophe, then parse the JSON
            // back into whatever shape it was originally saved in.
            const cleanItemsRaw = (itemsRaw || "").toString().replace(/^'/, "");

            let items = [];
            try {
                items = cleanItemsRaw ? JSON.parse(cleanItemsRaw) : [];
            } catch (parseErr) {
                console.error(`Failed to parse items for bill ${id}:`, parseErr.message);
                items = [];
            }

            return {
                id: id || "",
                billNo: billNo || "",
                date: date || "",
                time: time || "",
                customerName: customerName || "",
                subtotal: Number(subtotal) || 0,
                discount: Number(discount) || 0,
                gstRate: Number(gstRate) || 0,
                gst: Number(gst) || 0,
                total: Number(total) || 0,
                paymentMode: paymentMode || "",
                cashGiven: Number(cashGiven) || 0,
                backupStatus: backupStatus === "TRUE" || backupStatus === true,
                items
            };
        });

        return res.json({
            success: true,
            data: { bills, products }
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
});
module.exports = router;