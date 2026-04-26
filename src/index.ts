import "reflect-metadata";
import { taskWorker } from "./workers/taskWorker";
import { AppDataSource } from "./data-source";
import { createApp } from "./app";

async function main() {
  await AppDataSource.initialize();
  taskWorker();

  const app = createApp(AppDataSource);
  app.listen(3000, () => {
    console.log("Server is running at http://localhost:3000");
  });
}

main().catch((error) => console.log(error));
