const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const ROOT = path.join(__dirname, "..");
const ENV_PATH = path.join(ROOT, ".env.local");
const OLD_ENV_PATH = path.join(ROOT, ".env.local.old");
const FRESH_ENV_PATH = path.join(ROOT, ".env.local.fresh");
const OLD_DB = "savitri_salary";
const FRESH_DB = "savitri_salary_fresh";

const command = process.argv[2] || "status";

main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
});

async function main() {
    if (!fs.existsSync(ENV_PATH)) {
        throw new Error(".env.local not found.");
    }
    if (command === "old" || command === "fresh") {
        const targetDb = command === "fresh" ? FRESH_DB : OLD_DB;
        await ensureProfiles();
        await switchEnv(targetDb);
        if (command === "fresh") {
            await ensureFreshDatabase();
        }
        console.log(`Switched .env.local to MongoDB database: ${targetDb}`);
        console.log("Restart the Next.js dev server for this change to load.");
        return;
    }
    if (command === "create-fresh") {
        await ensureProfiles();
        await ensureFreshDatabase();
        console.log(`Fresh database is ready: ${FRESH_DB}`);
        console.log("Current .env.local was not switched.");
        return;
    }
    if (command === "status") {
        const env = readEnv();
        const uri = getMongoUri(env);
        const dbName = getMongoDbName(env, uri);
        console.log(`Current .env.local database: ${dbName}`);
        console.log(`Old profile: ${OLD_DB}`);
        console.log(`Fresh profile: ${FRESH_DB}`);
        return;
    }
    throw new Error("Use: npm run db:status, npm run db:create-fresh, npm run db:old, or npm run db:fresh");
}

async function ensureProfiles() {
    const env = readEnv();
    if (!fs.existsSync(OLD_ENV_PATH)) {
        fs.writeFileSync(OLD_ENV_PATH, updateEnvDatabase(env, OLD_DB));
    }
    fs.writeFileSync(FRESH_ENV_PATH, updateEnvDatabase(env, FRESH_DB));
}

async function switchEnv(targetDb) {
    const env = readEnv();
    fs.writeFileSync(ENV_PATH, updateEnvDatabase(env, targetDb));
}

async function ensureFreshDatabase() {
    const env = updateEnvDatabase(readEnv(), FRESH_DB);
    const uri = getMongoUri(env);
    await mongoose.connect(uri, {
        dbName: FRESH_DB,
        serverSelectionTimeoutMS: 5000
    });
    await mongoose.connection.db.collection("database_profiles").updateOne(
        { name: "fresh" },
        {
            $set: {
                name: "fresh",
                database: FRESH_DB,
                purpose: "Fresh Salary Software database profile",
                updatedAt: new Date()
            },
            $setOnInsert: { createdAt: new Date() }
        },
        { upsert: true }
    );
    await mongoose.disconnect();
}

function readEnv() {
    return fs.readFileSync(ENV_PATH, "utf8");
}

function getMongoUri(env) {
    const value = getEnvValue(env, "MONGODB_URI");
    if (!value) {
        throw new Error("MONGODB_URI not found in .env.local.");
    }
    return value;
}

function getMongoDbName(env, uri) {
    const explicit = getEnvValue(env, "MONGODB_DB");
    if (explicit)
        return explicit;
    return new URL(uri).pathname.replace(/^\//, "") || OLD_DB;
}

function updateEnvDatabase(env, dbName) {
    const uri = getMongoUri(env);
    const nextUri = withDatabase(uri, dbName);
    let next = setEnvValue(env, "MONGODB_URI", nextUri);
    next = setEnvValue(next, "MONGODB_DB", dbName);
    return next;
}

function withDatabase(uri, dbName) {
    const parsed = new URL(uri);
    parsed.pathname = `/${dbName}`;
    return parsed.toString();
}

function getEnvValue(env, key) {
    const line = env.split(/\r?\n/).find((item) => new RegExp(`^\\s*${key}\\s*=`).test(item));
    if (!line)
        return "";
    return line.split("=").slice(1).join("=").trim().replace(/^['"]|['"]$/g, "");
}

function setEnvValue(env, key, value) {
    const lines = env.split(/\r?\n/);
    const index = lines.findIndex((line) => new RegExp(`^\\s*${key}\\s*=`).test(line));
    const nextLine = `${key}=${value}`;
    if (index === -1) {
        return `${env.replace(/\s*$/, "")}\n${nextLine}\n`;
    }
    lines[index] = nextLine;
    return lines.join("\n");
}
