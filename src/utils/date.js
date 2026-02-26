export function addMonths(input, months) {
    const date = input instanceof Date ? new Date(input.getTime()) : new Date(input);
    if (!Number.isFinite(date.getTime())) {
        throw new Error("Invalid date");
    }

    const wholeMonths = Number.isFinite(months) ? Math.trunc(months) : 0;
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const seconds = date.getUTCSeconds();
    const ms = date.getUTCMilliseconds();

    const targetMonthIndex = month + wholeMonths;
    const targetYear = year + Math.floor(targetMonthIndex / 12);
    const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
    const lastDayOfTargetMonth = new Date(
        Date.UTC(targetYear, targetMonth + 1, 0)
    ).getUTCDate();
    const targetDay = Math.min(day, lastDayOfTargetMonth);

    return new Date(
        Date.UTC(
            targetYear,
            targetMonth,
            targetDay,
            hours,
            minutes,
            seconds,
            ms
        )
    );
}

