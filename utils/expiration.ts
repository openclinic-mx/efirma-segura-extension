import {differenceInDays, formatDistanceToNow} from "date-fns";

export const expiresInDays = (expiredAt: Date, daysBefore = 30) => differenceInDays(expiredAt, new Date) <= daysBefore;

export const expirationColor = (expiredAt: Date) => {
    if (expiresInDays(expiredAt, 15)) {
        return 'error';
    }

    if (expiresInDays(expiredAt)) {
        return 'warning';
    }

    return 'info';
};

export const expirationText = (expiredAt: Date) => `Expira ${formatDistanceToNow(expiredAt, {addSuffix: true})}`;