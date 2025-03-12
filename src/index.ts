/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2025-03-10 20:08:34
 * @LastEditTime: 2025-03-10 20:59:17
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */
import { readFileSync } from "fs";
import {
  DocumentNode, Kind, NamedTypeNode,
  ObjectTypeExtensionNode, parse, TypeNode
} from "graphql";
// export
export * from "graphql";

const baseTypes = ['string', 'number', 'boolean', 'ID'];
export const operationTypes = ['Query', 'Mutation', 'Subscription'];
// 类型映射转换
const typeMap: any = {
  'ID': 'string',
  'String': 'string',
  'Int': 'number',
  'Float': 'number',
  'Boolean': 'boolean'
};

/**
 * @description: 解析graphql schema文件
 * @param {string} schemaFile
 * @return {*}
 */
export function parseGraphqlDocument(schemaFile: string): DocumentNode {
  const source = readFileSync(schemaFile, 'utf8');
  return parse(source);
}

/**
 * 解析SDL中的操作定义
 * @param {DocumentNode} document 
 * @returns {object}
 */
export function parseOperations(document: DocumentNode) {
  const operations: any = { Query: [], Mutation: [], Subscription: [] };

  document.definitions.forEach(def => {
    if (def.kind === Kind.OBJECT_TYPE_DEFINITION &&
      operationTypes.includes(def.name.value)) {
      const operationType = def.name.value;
      def?.fields.forEach(selection => {
        const fieldName = selection.name.value;
        operations[operationType].push({
          name: fieldName,
          args: selection?.arguments.map(arg => ({
            name: arg.name.value,
            type: getTypeName(arg.type)
          })),
          returnType: getTypeName(selection.type)
        });
      });
    }
  });

  return operations;
}

/**
 * 解析SDL中的类型定义
 * @param {DocumentNode} document
 * @returns {object}
 * */
export function parseTypeDefinitions(document: DocumentNode) {
  const typeMaps: any = {};
  document.definitions.forEach((def: ObjectTypeExtensionNode) => {
    if (['ObjectTypeDefinition', 'InputObjectTypeDefinition',
      'ScalarTypeDefinition'].includes(def.kind)) {
      typeMaps[def.name.value] = {
        kind: def.kind,
        name: def.name.value,
        fields: def.fields || []
      };
    }
  });
  return typeMaps;
}

/**
 * 获取类型名称
 * @param type 
 * @returns 
 */
export function getTypeName(type: TypeNode | NamedTypeNode): string {
  if (type.kind === 'NonNullType') {
    return `${getTypeName(type.type)}`;
  }
  if (type.kind === 'ListType') {
    return `${getTypeName(type.type)}[]`;
  }

  return typeMap[type.name.value] || type.name.value;
}