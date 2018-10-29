import {
  isArrayType,
  cypherDirectiveArgs,
  removeMatch,
  removeReturn,
  getReturnVal
} from './utils';

export const customCypherField = ({
  customCypher,
  schemaTypeRelation,
  initial,
  fieldName,
  fieldType,
  nestedVariable,
  variableName,
  headSelection,
  schemaType,
  resolveInfo,
  subSelection,
  skipLimit,
  commaIfTail,
  tailParams
}) => {
  if (schemaTypeRelation) {
    variableName = `${variableName}_relation`;
  }

  // Get value for RETURN to be used as primary object for projection
  const retVal = getReturnVal(customCypher);

  // Remove MATCH from subquery
  customCypher = removeMatch(customCypher);
  // Remove RETURN * from subquery
  customCypher = removeReturn(customCypher);

  const fieldIsList = !!fieldType.ofType;
  // similar: [ x IN apoc.cypher.runFirstColumn("WITH {this} AS this MATCH (this)--(:Genre)--(o:Movie) RETURN o", {this: movie}, true) |x {.title}][1..2])
  return {
    initial: `${initial}${fieldName}: ${
      fieldIsList ? '' : 'head('
    }[ ${customCypher} | ${retVal} {${subSelection[0]}}]${
      fieldIsList ? '' : ')'
    }${skipLimit} ${commaIfTail}`,
    ...tailParams
  };
};

export const relationFieldOnNodeType = ({
  initial,
  fieldName,
  fieldType,
  variableName,
  relDirection,
  relType,
  nestedVariable,
  isInlineFragment,
  interfaceLabel,
  innerSchemaType,
  queryParams,
  subSelection,
  skipLimit,
  commaIfTail,
  tailParams
}) => {
  return {
    initial: `${initial}${fieldName}: ${
      !isArrayType(fieldType) ? 'head(' : ''
    }[(${variableName})${
      relDirection === 'in' || relDirection === 'IN' ? '<' : ''
    }-[:${relType}]-${
      relDirection === 'out' || relDirection === 'OUT' ? '>' : ''
    }(${nestedVariable}:${
      isInlineFragment ? interfaceLabel : innerSchemaType.name
    }${queryParams}) | ${nestedVariable} {${
      isInlineFragment
        ? 'FRAGMENT_TYPE: "' + interfaceLabel + '",' + subSelection[0]
        : subSelection[0]
    }}]${!isArrayType(fieldType) ? ')' : ''}${skipLimit} ${commaIfTail}`,
    ...tailParams
  };
};

export const relationTypeFieldOnNodeType = ({
  innerSchemaTypeRelation,
  initial,
  fieldName,
  subSelection,
  skipLimit,
  commaIfTail,
  tailParams,
  fieldType,
  variableName,
  schemaType,
  nestedVariable,
  queryParams
}) => {
  if (innerSchemaTypeRelation.from === innerSchemaTypeRelation.to) {
    return {
      initial: `${initial}${fieldName}: {${
        subSelection[0]
      }}${skipLimit} ${commaIfTail}`,
      ...tailParams
    };
  }
  return {
    initial: `${initial}${fieldName}: ${
      !isArrayType(fieldType) ? 'head(' : ''
    }[(${variableName})${
      schemaType.name === innerSchemaTypeRelation.to ? '<' : ''
    }-[${nestedVariable}_relation:${
      innerSchemaTypeRelation.name
    }${queryParams}]-${
      schemaType.name === innerSchemaTypeRelation.from ? '>' : ''
    }(:${
      schemaType.name === innerSchemaTypeRelation.from
        ? innerSchemaTypeRelation.to
        : innerSchemaTypeRelation.from
    }) | ${nestedVariable}_relation {${subSelection[0]}}]${
      !isArrayType(fieldType) ? ')' : ''
    }${skipLimit} ${commaIfTail}`,
    ...tailParams
  };
};

export const nodeTypeFieldOnRelationType = ({
  fieldInfo,
  rootVariableNames,
  schemaTypeRelation,
  innerSchemaType,
  isInlineFragment,
  interfaceLabel
}) => {
  if (rootVariableNames) {
    // Special case used by relation mutation payloads
    // rootVariableNames is persisted for sibling directed fields
    return relationTypeMutationPayloadField({
      ...fieldInfo,
      rootVariableNames
    });
  } else {
    // Normal case of schemaType with a relationship directive
    return directedFieldOnReflexiveRelationType({
      ...fieldInfo,
      schemaTypeRelation,
      innerSchemaType,
      isInlineFragment,
      interfaceLabel
    });
  }
};

const relationTypeMutationPayloadField = ({
  initial,
  fieldName,
  variableName,
  subSelection,
  skipLimit,
  commaIfTail,
  tailParams,
  rootVariableNames
}) => {
  return {
    initial: `${initial}${fieldName}: ${variableName} {${
      subSelection[0]
    }}${skipLimit} ${commaIfTail}`,
    ...tailParams,
    rootVariableNames,
    variableName:
      fieldName === 'from' ? rootVariableNames.to : rootVariableNames.from
  };
};

const directedFieldOnReflexiveRelationType = ({
  initial,
  fieldName,
  fieldType,
  variableName,
  queryParams,
  nestedVariable,
  subSelection,
  skipLimit,
  commaIfTail,
  tailParams,
  schemaTypeRelation,
  innerSchemaType,
  isInlineFragment,
  interfaceLabel
}) => {
  const relType = schemaTypeRelation.name;
  const fromTypeName = schemaTypeRelation.from;
  const toTypeName = schemaTypeRelation.to;
  const isFromField = fieldName === fromTypeName || fieldName === 'from';
  const isToField = fieldName === toTypeName || fieldName === 'to';
  const relationshipVariableName = `${variableName}_${
    isFromField ? 'from' : 'to'
  }_relation`;
  // Since the translations are significantly different,
  // we first check whether the relationship is reflexive
  if (fromTypeName === toTypeName) {
    if (fieldName === 'from' || fieldName === 'to') {
      return {
        initial: `${initial}${fieldName}: ${
          !isArrayType(fieldType) ? 'head(' : ''
        }[(${variableName})${
          isFromField ? '<' : ''
        }-[${relationshipVariableName}:${relType}${queryParams}]-${
          isToField ? '>' : ''
        }(${nestedVariable}:${
          isInlineFragment ? interfaceLabel : fromTypeName
        }) | ${relationshipVariableName} {${
          isInlineFragment
            ? 'FRAGMENT_TYPE: "' + interfaceLabel + '",' + subSelection[0]
            : subSelection[0]
        }}]${!isArrayType(fieldType) ? ')' : ''}${skipLimit} ${commaIfTail}`,
        ...tailParams
      };
    } else {
      // Case of a renamed directed field
      return {
        initial: `${initial}${fieldName}: ${variableName} {${
          subSelection[0]
        }}${skipLimit} ${commaIfTail}`,
        ...tailParams
      };
    }
  }
  // Related node types are different
  return {
    initial: `${initial}${fieldName}: ${
      !isArrayType(fieldType) ? 'head(' : ''
    }[(:${isFromField ? toTypeName : fromTypeName})${
      isFromField ? '<' : ''
    }-[${variableName}_relation]-${isToField ? '>' : ''}(${nestedVariable}:${
      isInlineFragment ? interfaceLabel : innerSchemaType.name
    }${queryParams}) | ${nestedVariable} {${
      isInlineFragment
        ? 'FRAGMENT_TYPE: "' + interfaceLabel + '",' + subSelection[0]
        : subSelection[0]
    }}]${!isArrayType(fieldType) ? ')' : ''}${skipLimit} ${commaIfTail}`,
    ...tailParams
  };
};
