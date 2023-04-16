import type {
    NextApiRequest,
    NextApiResponse
} from 'next';
import {
    OpenAIEmbeddings
} from 'langchain/embeddings';
import {
    PineconeStore
} from 'langchain/vectorstores';

import {
    OpenAIChat
} from "langchain/llms";

import {
    Configuration,
    OpenAIApi
} from "openai";


import {
    PineconeClient
} from "@pinecone-database/pinecone";
import {
    loadQAStuffChain
} from "langchain/chains";
import { querystring } from '@pinecone-database/pinecone/dist/pinecone-generated-ts-fetch';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse,
) {
    const {
        question,
        history,
        filter
    }
        : {
            question: string;
            history: string;
            filter: any;
        }
        = req.body;

    if (!question) {
        return res.status(400).json({
            message: 'No question in the request'
        });
    }
    // OpenAI recommends replacing newlines with spaces for best results
    const sanitizedQuestion = question.trim().replaceAll('\n', ' ');
    const filter_string: Array<string> = [];
    
    Object.values(filter).forEach((value: any) => {
        if (value[0])
            filter_string.push(value[0].name);
    });

    // Initialize Pinecone
    const client = new PineconeClient();
    await client.init({
        apiKey: process.env.PINECONE_API_KEY ?? "",
        environment: process.env.PINECONE_ENVIRONMENT ?? "",
    });

    const pineconeIndex = client.Index(process.env.PINECONE_INDEX_NAME ?? "");
    const vectorStore = await PineconeStore.fromExistingIndex(
        new OpenAIEmbeddings({
            openAIApiKey: process.env.OPENAI_API_KEY
        }), {
        pineconeIndex,
        namespace: process.env.PINECONE_NAME_SPACE
    }
    );

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
    });

    const sendData = (data: string) => {
        res.write(`data: ${data}\n\n`);
    };

    sendData(JSON.stringify({
        data: ''
    }));

    // Initialize OpenAI
    const configuration = new Configuration({
        apiKey: process.env.OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(configuration);


    try {
        const llm = new OpenAIChat({
            temperature: 0,
            topP: 1,
            frequencyPenalty: 0,
            presencePenalty: 0,
            openAIApiKey: process.env.OPENAI_API_KEY
        });

        const queryList: any = {
            Interest: [],
            Canton: [],
            Commune: []
        };

        
        //Generate metadata filter query
        Object.entries(filter).forEach(([key, obj]: [string, any]) => {
            obj.forEach((item: { name: string, id: number }) => {
                queryList[key].push(item.name);
            })
        });

        
        const query = {
            "$and": Object.entries(queryList).reduce((totalArray: Object[], [key, nameList]: [string, any]) => {
                const temp = totalArray.concat();
                if(nameList.length>0)
                {
                    temp.push({
                        [key]: {
                            "$in": ["ALL", ...nameList]
                        }
                    });
                }
                return temp;
            }, [])
        };


        const score_data: [any, number][] = await vectorStore.similaritySearchWithScore(sanitizedQuestion, 10, query);

        console.log("score---", score_data);

        let output = score_data.filter(([doc, score]: (any | number)[]) => {
            if (Number(score) > 0.87)
                return true;
            return false;
        });

        //if there are no similarities, clear output and also make normal call for ChatGPT to answer the generically question without any vector

        if (output.length === 1000) {

            const OpenAI_response = await openai.createChatCompletion({
                model: "gpt-3.5-turbo",
                messages: [{
                    role: "system",
                    content: "You are ArchGPT, an AI assistance for architects and engineers looking for answers about Switzerland norms and regulations",
                },
                {
                    role: "user",
                    content: sanitizedQuestion,
                },

                ],
            });

            const chat_result = OpenAI_response.data.choices[0]?.message?.content;

            sendData(JSON.stringify({
                data: chat_result
            }));
			
        } else {
           // const chainA = loadQAStuffChain(llm);
           // let resA = await chainA.call({
           //     input_documents: score_data,
           //     question: sanitizedQuestion,
           // });
           let resB = "See references below"
           // console.log("------resA", resA.text);
            sendData(JSON.stringify({
                //data: resA.text
                data: resB
            }));


            sendData(JSON.stringify({
                sourceDocs: output
            }));

			
            
            
        }

    } catch (error) {
        console.log('error', error);
    } finally {
        sendData('[DONE]');
        res.end();
    }
}
