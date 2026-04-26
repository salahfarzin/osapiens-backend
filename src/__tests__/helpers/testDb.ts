import { DataSource } from 'typeorm';
import { Task } from '../../models/Task';
import { Result } from '../../models/Result';
import { Workflow } from '../../models/Workflow';

let dataSource: DataSource;

export function getDataSource(): DataSource {
    return dataSource;
}

export function useTestDatabase(): void {
    beforeAll(async () => {
        dataSource = new DataSource({
            type: 'sqlite',
            database: ':memory:',
            entities: [Task, Result, Workflow],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();
    });

    afterAll(async () => {
        await dataSource.destroy();
    });

    afterEach(async () => {
        await dataSource.getRepository(Result).clear();
        await dataSource.getRepository(Task).clear();
        await dataSource.getRepository(Workflow).clear();
    });
}
