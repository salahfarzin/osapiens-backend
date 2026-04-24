import { area } from '@turf/turf';
import type { Feature, GeoJSON, MultiPolygon, Polygon } from 'geojson';
import { Job } from './Job';
import { Task } from '../models/Task';

const AREA_UNIT = 'm2';

export interface PolygonAreaResult {
    area: number;
    unit: typeof AREA_UNIT;
}

export class PolygonAreaJob implements Job {
    async run(task: Task): Promise<PolygonAreaResult> {
        console.log(`Calculating polygon area for task ${task.taskId}...`);

        let geoJson: GeoJSON;
        try {
            geoJson = JSON.parse(task.geoJson) as GeoJSON;
        } catch {
            throw new Error(`Task ${task.taskId}: invalid GeoJSON — JSON parse failed`);
        }

        const geometryType = geoJson.type === 'Feature' ? (geoJson.geometry?.type ?? '') : geoJson.type;

        if (geometryType !== 'Polygon' && geometryType !== 'MultiPolygon') {
            throw new Error(
                `Task ${task.taskId}: unsupported geometry type "${geometryType}" — expected Polygon or MultiPolygon`
            );
        }

        const calculatedArea = area(geoJson as Feature<Polygon | MultiPolygon>);

        console.log(`Polygon area for task ${task.taskId}: ${calculatedArea} ${AREA_UNIT}`);

        return { area: calculatedArea, unit: AREA_UNIT };
    }
}
