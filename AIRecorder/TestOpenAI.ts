import { OpenAIProvider } from "./Providers/OpenAIProvider";

async function main() {

    const provider = new OpenAIProvider();

    const result = await provider.generate(
        "Reply only with the word SUCCESS."
    );

    console.log(result);

}

main();
