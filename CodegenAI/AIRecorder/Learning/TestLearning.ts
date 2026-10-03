import { MemoryEngine } from "./MemoryEngine";
import { FrameworkIndexer } from "./FrameworkIndexer";
import { LearningEntry } from "./LearningModels";

const entries: LearningEntry[] = [

    {
        key: "OpenDealsPage",
        value: "DealsCompletionStatusMethods.OpenDealsCompletionStatusPageAsync",
        source: "PageAction",
        usageCount: 0,
        lastUsed: ""
    },

    {
        key: "TransactionId",
        value: "CaptureTransIdFromGeneratedRowAndOpenTransactionAsync",
        source: "PageAction",
        usageCount: 0,
        lastUsed: ""
    },

    {
        key: "AmountLocator",
        value: "DealViewAmountLinks",
        source: "Locator",
        usageCount: 0,
        lastUsed: ""
    }

];

const memory =
    new MemoryEngine();

const snapshot =
    memory.learn(entries);

console.log(snapshot);

const indexer =
    new FrameworkIndexer();

const index =
    indexer.index(snapshot.entries);

console.log(index);