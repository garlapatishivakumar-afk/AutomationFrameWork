export type WaitStrategy =
    | "domcontentloaded"
    | "networkidle"
    | "loader-hidden"
    | "element-stable"
    | "none";

export interface WaitOptions {

    timeoutMs?: number;

    pollMs?: number;

    strategy?: WaitStrategy;

}
