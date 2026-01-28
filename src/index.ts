/*
 * @Description: GraphQL schema parser and code generator
 * @Usage: Parse GraphQL SDL and generate TypeScript DTO
 * @Author: richen
 * @Date: 2025-03-10 20:08:34
 * @LastEditTime: 2025-01-28 15:00:00
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */
import { readFileSync, existsSync } from "fs";
import {
  DocumentNode, Kind, NamedTypeNode,
  ObjectTypeDefinitionNode, InputObjectTypeDefinitionNode,
  ScalarTypeDefinitionNode, InterfaceTypeDefinitionNode,
  UnionTypeDefinitionNode, EnumTypeDefinitionNode, parse, TypeNode,
  FieldDefinitionNode, InputValueDefinitionNode
} from "graphql";

export * from "graphql";

export const baseTypes = ['string', 'number', 'boolean', 'ID'];
export const operationTypes = ['Query', 'Mutation', 'Subscription'];

export interface GraphQLScalarTypeMap {
  'ID': string;
  'String': string;
  'Int': string;
  'Float': string;
  'Boolean': string;
  [key: string]: string;
}

export interface OperationArg {
  name: string;
  type: string;
}

export interface OperationField {
  name: string;
  args: OperationArg[];
  returnType: string;
}

export interface OperationsMap {
  Query: OperationField[];
  Mutation: OperationField[];
  Subscription: OperationField[];
}

export interface FieldInfo {
  kind: string;
  name: string;
  type: string;
  description?: string;
}

export interface TypeDefinitionInfo {
  kind: string;
  name: string;
  fields: FieldInfo[];
  description?: string;
}

export interface TypeDefinitionMap {
  [key: string]: TypeDefinitionInfo;
}

export interface EnumTypeInfo {
  kind: 'EnumTypeDefinition';
  name: string;
  values: string[];
  description?: string;
}

export interface InterfaceTypeInfo {
  kind: 'InterfaceTypeDefinition';
  name: string;
  fields: FieldInfo[];
  description?: string;
}

export interface UnionTypeInfo {
  kind: 'UnionTypeDefinition';
  name: string;
  types: string[];
  description?: string;
}

export interface ExtendedTypeMap {
  objects: TypeDefinitionMap;
  inputs: TypeDefinitionMap;
  scalars: TypeDefinitionMap;
  enums: { [key: string]: EnumTypeInfo };
  interfaces: { [key: string]: InterfaceTypeInfo };
  unions: { [key: string]: UnionTypeInfo };
}

export interface GenerateOptions {
  prefix?: string;
  suffix?: string;
  useEnumType?: boolean;
  useInterfaceType?: boolean;
  outputDir?: string;
  strictNullChecks?: boolean;
}

export interface GenerateResult {
  filename: string;
  content: string;
}

export class GraphQLParseError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'GraphQLParseError';
    if (cause) {
      this.stack = cause.stack;
    }
  }
}

const typeMap: GraphQLScalarTypeMap = {
  'ID': 'string',
  'String': 'string',
  'Int': 'number',
  'Float': 'number',
  'Boolean': 'boolean'
};

export function parseGraphqlDocument(schemaFile: string): DocumentNode {
  if (!existsSync(schemaFile)) {
    throw new GraphQLParseError(`Schema file not found: ${schemaFile}`);
  }
  try {
    const source = readFileSync(schemaFile, 'utf8');
    return parse(source);
  } catch (error) {
    if (error instanceof GraphQLParseError) {
      throw error;
    }
    throw new GraphQLParseError(
      `Failed to parse schema file: ${schemaFile}`,
      error instanceof Error ? error : undefined
    );
  }
}

export function parseOperations(document: DocumentNode): OperationsMap {
  const operations: OperationsMap = {
    Query: [],
    Mutation: [],
    Subscription: []
  };

  for (const def of document.definitions) {
    if (def.kind === Kind.OBJECT_TYPE_DEFINITION &&
      operationTypes.includes(def.name.value)) {
      const operationType = def.name.value as keyof OperationsMap;
      const fields = def.fields || [];

      for (const field of fields) {
        const fieldName = field.name.value;
        const args = field.arguments?.map((arg: InputValueDefinitionNode) => ({
          name: arg.name.value,
          type: getTypeName(arg.type)
        })) || [];

        operations[operationType].push({
          name: fieldName,
          args,
          returnType: getTypeName(field.type)
        });
      }
    }
  }

  return operations;
}

export function parseTypeDefinitions(document: DocumentNode): TypeDefinitionMap {
  const typeMaps: TypeDefinitionMap = {};

  for (const def of document.definitions) {
    if (def.kind === Kind.OBJECT_TYPE_DEFINITION ||
      def.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION ||
      def.kind === Kind.SCALAR_TYPE_DEFINITION) {

      const fields = (def as ObjectTypeDefinitionNode).fields?.map((f: FieldDefinitionNode) => ({
        kind: def.kind,
        name: f.name.value,
        type: getTypeName(f.type),
        description: f.description?.value
      })) || [];

      typeMaps[def.name.value] = {
        kind: def.kind,
        name: def.name.value,
        fields,
        description: (def as ObjectTypeDefinitionNode).description?.value
      };
    }
  }

  return typeMaps;
}

export function parseExtendedTypes(document: DocumentNode): ExtendedTypeMap {
  const result: ExtendedTypeMap = {
    objects: {},
    inputs: {},
    scalars: {},
    enums: {},
    interfaces: {},
    unions: {}
  };

  for (const def of document.definitions) {
    switch (def.kind) {
      case Kind.OBJECT_TYPE_DEFINITION: {
        const typeDef = def as ObjectTypeDefinitionNode;
        const fields = typeDef.fields?.map((f: FieldDefinitionNode) => ({
          kind: Kind.OBJECT_TYPE_DEFINITION,
          name: f.name.value,
          type: getTypeName(f.type),
          description: f.description?.value
        })) || [];

        result.objects[typeDef.name.value] = {
          kind: Kind.OBJECT_TYPE_DEFINITION,
          name: typeDef.name.value,
          fields,
          description: typeDef.description?.value
        };
        break;
      }

      case Kind.INPUT_OBJECT_TYPE_DEFINITION: {
        const inputDef = def as InputObjectTypeDefinitionNode;
        const fields = inputDef.fields?.map((f: InputValueDefinitionNode) => ({
          kind: Kind.INPUT_OBJECT_TYPE_DEFINITION,
          name: f.name.value,
          type: getTypeName(f.type),
          description: f.description?.value
        })) || [];

        result.inputs[inputDef.name.value] = {
          kind: Kind.INPUT_OBJECT_TYPE_DEFINITION,
          name: inputDef.name.value,
          fields,
          description: inputDef.description?.value
        };
        break;
      }

      case Kind.SCALAR_TYPE_DEFINITION: {
        const scalarDef = def as ScalarTypeDefinitionNode;
        result.scalars[scalarDef.name.value] = {
          kind: Kind.SCALAR_TYPE_DEFINITION,
          name: scalarDef.name.value,
          fields: [],
          description: scalarDef.description?.value
        };
        break;
      }

      case Kind.ENUM_TYPE_DEFINITION: {
        const enumDef = def as EnumTypeDefinitionNode;
        result.enums[enumDef.name.value] = {
          kind: Kind.ENUM_TYPE_DEFINITION,
          name: enumDef.name.value,
          values: enumDef.values?.map(v => v.name.value) || [],
          description: enumDef.description?.value
        };
        break;
      }

      case Kind.INTERFACE_TYPE_DEFINITION: {
        const interfaceDef = def as InterfaceTypeDefinitionNode;
        const fields = interfaceDef.fields?.map((f: FieldDefinitionNode) => ({
          kind: Kind.INTERFACE_TYPE_DEFINITION,
          name: f.name.value,
          type: getTypeName(f.type),
          description: f.description?.value
        })) || [];

        result.interfaces[interfaceDef.name.value] = {
          kind: Kind.INTERFACE_TYPE_DEFINITION,
          name: interfaceDef.name.value,
          fields,
          description: interfaceDef.description?.value
        };
        break;
      }

      case Kind.UNION_TYPE_DEFINITION: {
        const unionDef = def as UnionTypeDefinitionNode;
        result.unions[unionDef.name.value] = {
          kind: Kind.UNION_TYPE_DEFINITION,
          name: unionDef.name.value,
          types: unionDef.types?.map(t => t.name.value) || [],
          description: unionDef.description?.value
        };
        break;
      }
    }
  }

  return result;
}

export function getTypeName(type: TypeNode | NamedTypeNode): string {
  if (type.kind === Kind.NON_NULL_TYPE) {
    return `${getTypeName(type.type)}`;
  }
  if (type.kind === Kind.LIST_TYPE) {
    return `${getTypeName(type.type)}[]`;
  }

  const typeName = type.name.value;
  return typeMap[typeName] || typeName;
}

export function getScalarTypeMap(): Readonly<GraphQLScalarTypeMap> {
  return Object.freeze({ ...typeMap });
}

export function updateScalarTypeMap(map: Partial<GraphQLScalarTypeMap>): void {
  Object.assign(typeMap, map);
}

function formatTypeName(name: string, options: GenerateOptions): string {
  const prefix = options.prefix || '';
  const suffix = options.suffix || '';
  return `${prefix}${name}${suffix}`;
}

function getTypeScriptType(type: string, options: GenerateOptions): string {
  if (type.endsWith('[]')) {
    const innerType = type.slice(0, -2);
    return `${getTypeScriptType(innerType, options)}[]`;
  }

  const formattedName = formatTypeName(type, options);
  const scalarMap = getScalarTypeMap();

  if (scalarMap[type]) {
    return scalarMap[type];
  }

  return formattedName;
}

function generateFieldDeclaration(field: FieldInfo, options: GenerateOptions): string {
  const tsType = getTypeScriptType(field.type, options);
  const optional = !field.type.includes('!') && options.strictNullChecks ? '?' : '';
  return `  ${field.name}${optional}: ${tsType};`;
}

function generateTypeDefinition(info: TypeDefinitionInfo, options: GenerateOptions): string {
  const typeName = formatTypeName(info.name, options);
  const fields = info.fields.map(f => generateFieldDeclaration(f, options)).join('\n');

  if (info.kind === Kind.SCALAR_TYPE_DEFINITION) {
    return `export type ${typeName} = string;`;
  }

  return `export interface ${typeName} {\n${fields}\n}`;
}

function generateEnumDeclaration(info: EnumTypeInfo, options: GenerateOptions): string {
  const enumName = formatTypeName(info.name, options);
  const values = info.values.map(v => `  ${v} = '${v}'`).join(',\n');

  if (options.useEnumType) {
    return `export const ${enumName} = {\n${values}\n} as const;\n\nexport type ${enumName} = typeof ${enumName}[keyof typeof ${enumName}];`;
  }

  return `export enum ${enumName} {\n${values}\n}`;
}

function generateInterfaceDeclaration(info: InterfaceTypeInfo, options: GenerateOptions): string {
  const interfaceName = formatTypeName(info.name, options);
  const fields = info.fields.map(f => generateFieldDeclaration(f, options)).join('\n');

  if (options.useInterfaceType) {
    return `export interface ${interfaceName} {\n${fields}\n}`;
  }

  return `export type ${interfaceName} = {\n${fields}\n};`;
}

function generateUnionDeclaration(info: UnionTypeInfo, options: GenerateOptions): string {
  const unionName = formatTypeName(info.name, options);
  const types = info.types.map(t => formatTypeName(t, options)).join(' | ');
  return `export type ${unionName} = ${types};`;
}

export function generateTypeScriptTypes(
  typeDefinitions: TypeDefinitionMap,
  options: GenerateOptions = {}
): string {
  const defaultOptions: GenerateOptions = {
    prefix: '',
    suffix: '',
    useEnumType: false,
    useInterfaceType: false,
    strictNullChecks: false,
    ...options
  };

  const lines: string[] = [
    '/* Auto-generated by koatty-graphql */',
    '',
    '// Type Definitions',
    ''
  ];

  for (const info of Object.values(typeDefinitions)) {
    lines.push(generateTypeDefinition(info, defaultOptions));
    lines.push('');
  }

  return lines.join('\n');
}

export function generateInputTypes(
  inputDefinitions: TypeDefinitionMap,
  options: GenerateOptions = {}
): string {
  const defaultOptions: GenerateOptions = {
    prefix: '',
    suffix: '',
    strictNullChecks: false,
    ...options
  };

  const lines: string[] = [
    '/* Auto-generated by koatty-graphql */',
    '',
    '// Input Types',
    ''
  ];

  for (const info of Object.values(inputDefinitions)) {
    lines.push(generateTypeDefinition(info, defaultOptions));
    lines.push('');
  }

  return lines.join('\n');
}

export function generateEnums(
  enumDefinitions: { [key: string]: EnumTypeInfo },
  options: GenerateOptions = {}
): string {
  const defaultOptions: GenerateOptions = {
    useEnumType: false,
    ...options
  };

  const lines: string[] = [
    '/* Auto-generated by koatty-graphql */',
    '',
    '// Enum Types',
    ''
  ];

  for (const info of Object.values(enumDefinitions)) {
    lines.push(generateEnumDeclaration(info, defaultOptions));
    lines.push('');
  }

  return lines.join('\n');
}

export function generateInterfaces(
  interfaceDefinitions: { [key: string]: InterfaceTypeInfo },
  options: GenerateOptions = {}
): string {
  const defaultOptions: GenerateOptions = {
    useInterfaceType: false,
    ...options
  };

  const lines: string[] = [
    '/* Auto-generated by koatty-graphql */',
    '',
    '// Interface Types',
    ''
  ];

  for (const info of Object.values(interfaceDefinitions)) {
    lines.push(generateInterfaceDeclaration(info, defaultOptions));
    lines.push('');
  }

  return lines.join('\n');
}

export function generateUnions(
  unionDefinitions: { [key: string]: UnionTypeInfo },
  options: GenerateOptions = {}
): string {
  const defaultOptions: GenerateOptions = {
    ...options
  };

  const lines: string[] = [
    '/* Auto-generated by koatty-graphql */',
    '',
    '// Union Types',
    ''
  ];

  for (const info of Object.values(unionDefinitions)) {
    lines.push(generateUnionDeclaration(info, defaultOptions));
    lines.push('');
  }

  return lines.join('\n');
}

export function generateOperations(
  operations: OperationsMap,
  options: GenerateOptions = {}
): string {
  const defaultOptions: GenerateOptions = {
    prefix: '',
    suffix: '',
    ...options
  };

  const lines: string[] = [
    '/* Auto-generated by koatty-graphql */',
    '',
    '// Operations',
    ''
  ];

  for (const [operationType, fields] of Object.entries(operations)) {
    const interfaceName = formatTypeName(operationType, defaultOptions);
    const fieldLines = fields.map((f: OperationField) => {
      const args = f.args.map((a: OperationArg) => `${a.name}: ${getTypeScriptType(a.type, defaultOptions)}`).join(', ');
      const returnType = getTypeScriptType(f.returnType, defaultOptions);
      return `  ${f.name}(${args}): ${returnType};`;
    }).join('\n');

    lines.push(`export interface ${interfaceName} {`);
    lines.push(fieldLines);
    lines.push(`}`);
    lines.push('');
  }

  return lines.join('\n');
}

export function generateAll(
  document: DocumentNode,
  options: GenerateOptions = {}
): GenerateResult[] {
  const extendedTypes = parseExtendedTypes(document);
  const operations = parseOperations(document);

  const results: GenerateResult[] = [];

  if (Object.keys(extendedTypes.objects).length > 0) {
    results.push({
      filename: 'types.ts',
      content: generateTypeScriptTypes(extendedTypes.objects, options)
    });
  }

  if (Object.keys(extendedTypes.inputs).length > 0) {
    results.push({
      filename: 'inputs.ts',
      content: generateInputTypes(extendedTypes.inputs, options)
    });
  }

  if (Object.keys(extendedTypes.enums).length > 0) {
    results.push({
      filename: 'enums.ts',
      content: generateEnums(extendedTypes.enums, options)
    });
  }

  if (Object.keys(extendedTypes.interfaces).length > 0) {
    results.push({
      filename: 'interfaces.ts',
      content: generateInterfaces(extendedTypes.interfaces, options)
    });
  }

  if (Object.keys(extendedTypes.unions).length > 0) {
    results.push({
      filename: 'unions.ts',
      content: generateUnions(extendedTypes.unions, options)
    });
  }

  const hasOperations = Object.keys(operations).some(
    key => operations[key as keyof OperationsMap].length > 0
  );
  if (hasOperations) {
    results.push({
      filename: 'operations.ts',
      content: generateOperations(operations, options)
    });
  }

  return results;
}
