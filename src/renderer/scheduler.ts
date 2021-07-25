export async function scheduleRepeating<T>(
    ...tasks: ((arg: T) => T | Promise<T>)[]
) {
    const scheduledTasks = tasks.filter(t => typeof t === "function");
    let executedTasks = 0, elapsedTime = 0, latestResult: T;
    const next = async (): Promise<void> => {
        if (scheduledTasks.length > 0) {
            const timer = await scheduler.schedule();
            let executed = 0;
            while (scheduledTasks.length > 0 && !timer.didTimeout && (timer.timeRemaining > elapsedTime * 1.2 || !executed++)) {
                const startup = Date.now();
                latestResult = await scheduledTasks.shift()(latestResult);
                elapsedTime = (elapsedTime * executedTasks++ + Date.now() - startup) / executedTasks
            }
            return next();
        } else return;
    }
    return next();
}

export interface SchedulerTaskTimer {
    readonly timeRemaining: number;
    readonly didTimeout: boolean;
}

class Scheduler {
    #queue: ((timer: SchedulerTaskTimer) => void | Promise<void>)[] = [];
    private needsRefresh: boolean;
    private frameTimeTarget = 16;

    public schedule(op: (timer: SchedulerTaskTimer) => void | Promise<void>): true;
    public schedule(): Promise<SchedulerTaskTimer>;
    public schedule(op?: (timer: SchedulerTaskTimer) => void | Promise<void>) {
        let pr: (timer: SchedulerTaskTimer) => void = undefined;
        const promise = !op ? new Promise<SchedulerTaskTimer>(res => pr = res) : undefined;
        this.#queue.push(!op ? pr : op);
        if (this.needsRefresh) return !!op || promise;
        this.needsRefresh = true;
        this.prepare();
        return !!op || promise;
    }

    private prepare(lastFrame?: number) {
        const range = this.#queue.length;
        let processed = 0;
        requestAnimationFrame(async time => {
            if (lastFrame) this.frameTimeTarget = (this.frameTimeTarget * 2 + (time - lastFrame)) / 3;
            const startTime = Date.now();
            const target = this.frameTimeTarget;
            while (this.#queue.length) {
                const timer: SchedulerTaskTimer = {
                    get didTimeout() {
                        return (<SchedulerTaskTimer>this).timeRemaining / 2 < 1;
                    },
                    get timeRemaining() {
                        return startTime + target - Date.now();
                    }
                };
                if (timer.timeRemaining < 7 || ++processed > range) return this.prepare(time);
                await this.#queue.shift()?.(timer);
            }
            this.needsRefresh = false;
        });
    }
}

export const scheduler = new Scheduler();