export type ObservedId = {
	value: string | null;
	dynamic: boolean;
};

export type ObservedTable = {
	tagName: string | null;
	id: string | null;
	testId: string | null;
	role: string | null;
	className: string | null;
};

export type ObservedRow = {
	tagName: string | null;
	id: string | null;
	testId: string | null;
	role: string | null;
	className: string | null;
	labelValue?: string | null;
	businessValue: string | null;
	businessValueColumnIndex: number | null;
	rowValues: string[];
};

export type ObservedCell = {
	tagName: string | null;
	columnIndex: number | null;
	testId: string | null;
	role: string | null;
};

export type ObservedTarget = {
	tagName: string;
	text: string;
	role: string | null;
	testId: string | null;
	id: string | null;
};

export type ObservedActionDebug = {
	actionIndex: number;
	originalLocator: string;
	currentUrl: string;
	pageTitle: string;
	readyState: string;
	frameCount: number;
	frames: Array<{
		index: number;
		name: string | null;
		url: string | null;
		isMainFrame: boolean;
	}>;
	resolvedScope?: string;
	resolvedFrame?: {
		selector?: string;
		name?: string | null;
		url?: string | null;
	} | null;
	locatorMatchCount?: number;
	attachedState?: boolean;
	visibleState?: boolean;
	lastAttempt?: unknown;
	attempts?: unknown[];
	reason?: string;
};

export type ObservedAction = {
	line: number;
	raw: string;
	type: string;
	method?: string;
	text?: string;
	role?: string | null;
	scope?: string;
	frameSelector?: string | null;
	page?: string;
	matchCount?: number;
	isUnique?: boolean;
	duplicateText?: boolean;
	insideTable?: boolean;
	ancestors?: string[];
	table?: ObservedTable | null;
	row?: ObservedRow | null;
	cell?: ObservedCell | null;
	target?: ObservedTarget | null;
	tableScopedMatchCount?: number;
	sameBusinessRowCount?: number;
	rowId?: ObservedId | null;
	tableId?: ObservedId | null;
	originalLocator?: string;
	debug?: ObservedActionDebug;
	error?: string;
};

export type LiveObservationReport = {
	generatedAtUtc: string;
	source: {
		codeFilePath: string;
	};
	actions: ObservedAction[];
};

/**
 * Runtime implementation is in `AIRecorder/Intelligence/LiveObserver.cjs`.
 * This file defines the typed contract used by context and intelligence layers.
 */
