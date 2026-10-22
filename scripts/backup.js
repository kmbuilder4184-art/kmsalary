const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

// Parse .env.local to find MONGODB_URI
function getMongoUri() {
    try {
        const envPath = path.join(__dirname, "../.env.local");
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, "utf8");
            const match = content.match(/MONGODB_URI\s*=\s*(.+)/);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
    } catch (e) {
        console.error("Warning: could not parse .env.local:", e.message);
    }
    return "mongodb://127.0.0.1:27017/savitri_salary";
}

async function runBackup() {
    const mongoUri = getMongoUri();
    console.log(`Connecting to MongoDB at: ${mongoUri}`);

    try {
        await mongoose.connect(mongoUri);
        console.log("Connected successfully!");

        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        const backupData = {
            format: "salary-management-backup",
            version: 1,
            createdAt: new Date().toISOString(),
            collections: {}
        };

        for (const col of collections) {
            const name = col.name;
            // Exclude system indexes collections
            if (name.startsWith("system.")) continue;
            console.log(`Backing up collection: ${name}...`);
            const docs = await db.collection(name).find({}).toArray();
            backupData.collections[name] = docs;
        }

        // Create backups directory in root
        const backupsDir = path.join(__dirname, "../backups");
        if (!fs.existsSync(backupsDir)) {
            fs.mkdirSync(backupsDir, { recursive: true });
        }

        const dateStr = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `salary-backup-${dateStr}.json`;
        const filepath = path.join(backupsDir, filename);

        fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2), "utf8");
        console.log("\n=============================================");
        console.log(`Backup completed successfully!`);
        console.log(`Saved file: ${filepath}`);
        console.log("=============================================\n");
    } catch (error) {
        console.error("Backup failed:", error);
    } finally {
        await mongoose.disconnect();
    }
}

runBackup();
