import { Client } from "./client/client";

const main = async () => {
    const client = new Client();
    client.start();
}

main();