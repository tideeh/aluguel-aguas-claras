// Ponto de entrada da Lambda. O SDK v3 da AWS já vem no runtime Node.js da Lambda.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { criarHandler } from './logica.mjs';

const TABELA = process.env.TABELA;
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const repo = {
  async listar(pk) {
    const marcas = {};
    let inicio;
    do {
      const r = await db.send(new QueryCommand({
        TableName: TABELA,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': pk },
        ExclusiveStartKey: inicio
      }));
      for (const it of r.Items || []) {
        marcas[it.sk] = { fav: !!it.fav, oculto: !!it.oculto, nota: it.nota || '', em: it.em };
      }
      inicio = r.LastEvaluatedKey;
    } while (inicio);
    return marcas;
  },
  gravar: (pk, id, item) => db.send(new PutCommand({ TableName: TABELA, Item: { pk, sk: id, ...item } })),
  remover: (pk, id) => db.send(new DeleteCommand({ TableName: TABELA, Key: { pk, sk: id } }))
};

export const handler = criarHandler(repo);
