import { PolygonAreaJob } from '../jobs/PolygonAreaJob';
import { makeTask } from './helpers/fixtures';

const BRAZIL_POLYGON_JSON = JSON.stringify({
    type: 'Polygon',
    coordinates: [[
        [-63.624885020050996, -10.311050368263523],
        [-63.624885020050996, -10.367865108370523],
        [-63.61278302732815,  -10.367865108370523],
        [-63.61278302732815,  -10.311050368263523],
        [-63.624885020050996, -10.311050368263523],
    ]],
});

// The same geometry wrapped in a GeoJSON Feature.
const BRAZIL_FEATURE_JSON = JSON.stringify({
    type: 'Feature',
    properties: {},
    geometry: JSON.parse(BRAZIL_POLYGON_JSON),
});

const MULTIPOLYGON_JSON = JSON.stringify({
    type: 'MultiPolygon',
    coordinates: [
        [[
            [0, 0], [0, 1], [1, 1], [1, 0], [0, 0],
        ]],
        [[
            [2, 2], [2, 3], [3, 3], [3, 2], [2, 2],
        ]],
    ],
});

describe('PolygonAreaJob', () => {
    let job: PolygonAreaJob;

    beforeEach(() => {
        job = new PolygonAreaJob();
    });

    describe('successful area calculation', () => {
        it('returns a positive area in square meters for a raw Polygon geometry', async () => {
            const task = makeTask({ geoJson: BRAZIL_POLYGON_JSON });

            const result = await job.run(task);

            expect(result).toHaveProperty('area');
            expect(result).toHaveProperty('unit', 'm2');
            expect(result.area).toBeGreaterThan(0);
        });

        it('area for the Brazil sample polygon is in the expected range (~8 km²)', async () => {
            const task = makeTask({ geoJson: BRAZIL_POLYGON_JSON });

            const result = await job.run(task);

            // ~8 million m² — allow ±20% for floating-point and projection differences
            expect(result.area).toBeGreaterThan(6_000_000);
            expect(result.area).toBeLessThan(10_000_000);
        });

        it('accepts a GeoJSON Feature wrapper and returns the same area as the raw geometry', async () => {
            const rawTask = makeTask({ geoJson: BRAZIL_POLYGON_JSON });
            const featureTask = makeTask({ geoJson: BRAZIL_FEATURE_JSON });

            const rawResult = await job.run(rawTask);
            const featureResult = await job.run(featureTask);

            expect(featureResult.area).toBeCloseTo(rawResult.area, 0);
        });

        it('returns the combined area for a MultiPolygon', async () => {
            const task = makeTask({ geoJson: MULTIPOLYGON_JSON });

            const result = await job.run(task);

            // Two ~111km × 111km squares near the equator → total >> 0
            expect(result.area).toBeGreaterThan(0);
        });

    });

    describe('invalid GeoJSON handling', () => {
        it('throws an error when geoJson is not valid JSON', async () => {
            const task = makeTask({ geoJson: 'not-valid-json' });

            await expect(job.run(task)).rejects.toThrow('JSON parse failed');
        });

        it('includes the task ID in the parse error message', async () => {
            const task = makeTask({ geoJson: '{broken' });

            await expect(job.run(task)).rejects.toThrow(task.taskId);
        });

        it('throws an error for unsupported geometry type Point', async () => {
            const task = makeTask({
                geoJson: JSON.stringify({ type: 'Point', coordinates: [0, 0] }),
            });

            await expect(job.run(task)).rejects.toThrow('unsupported geometry type "Point"');
        });

        it('throws an error for unsupported geometry type LineString', async () => {
            const task = makeTask({
                geoJson: JSON.stringify({
                    type: 'LineString',
                    coordinates: [[0, 0], [1, 1]],
                }),
            });

            await expect(job.run(task)).rejects.toThrow('unsupported geometry type "LineString"');
        });

        it('throws an error when a Feature wraps an unsupported geometry type', async () => {
            const task = makeTask({
                geoJson: JSON.stringify({
                    type: 'Feature',
                    properties: {},
                    geometry: { type: 'Point', coordinates: [0, 0] },
                }),
            });

            await expect(job.run(task)).rejects.toThrow('unsupported geometry type "Point"');
        });

        it('throws an error for a GeometryCollection', async () => {
            const task = makeTask({
                geoJson: JSON.stringify({
                    type: 'GeometryCollection',
                    geometries: [{ type: 'Point', coordinates: [0, 0] }],
                }),
            });

            await expect(job.run(task)).rejects.toThrow('unsupported geometry type');
        });

        it('throws an error when a Feature has a null geometry', async () => {
            const task = makeTask({
                geoJson: JSON.stringify({ type: 'Feature', properties: {}, geometry: null }),
            });

            await expect(job.run(task)).rejects.toThrow('unsupported geometry type ""');
        });
    });
});
