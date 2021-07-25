export async function waitAnimationFrame() {
    return new Promise<void>(res => requestAnimationFrame(() => res()));
}

export async function waitIdleFrame() {
    return new Promise<IdleDeadline>(res => 
        requestIdleCallback((deadline: IdleDeadline) => res(deadline)));
}

export async function scheduleRepeating<T>(
    ...tasks: ((arg: T) => T | Promise<T>)[]
) {
    const scheduledTasks = tasks.filter(t => typeof t === "function");
    let executedTasks = 0, elapsedTime = 0, latestResult: T;
    const next = async (): Promise<void> => {
        if (scheduledTasks.length > 0) {
            const timer = await waitIdleFrame();
            let executed = 0;
            while (scheduledTasks.length > 0 && !timer.didTimeout && (timer.timeRemaining() > elapsedTime * 1.2 || !executed++)) {
                const startup = Date.now();
                latestResult = await scheduledTasks.shift()(latestResult);
                elapsedTime = (elapsedTime * executedTasks++ + Date.now() - startup) / executedTasks
            }
            return next();
        } else return;
    }
    return next();
}