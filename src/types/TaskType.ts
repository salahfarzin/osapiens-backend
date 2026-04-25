export const TaskType = {
    Analysis: 'analysis',
    Notification: 'notification',
    PolygonArea: 'polygonArea',
    Report: 'report',
} as const;

export type TaskType = typeof TaskType[keyof typeof TaskType];
