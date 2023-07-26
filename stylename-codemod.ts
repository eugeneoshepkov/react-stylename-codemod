import j, { JSXAttribute, Transform } from "jscodeshift";
import { JSCodeshift } from "jscodeshift/src/core";

/*
 * Rename the import identifier for clsx if it's not 'clsx'
 * before: import cn from 'clsx';
 * after: import clsx from 'clsx';
 */
const renameClsxImportIdentifier = (root) => {
  root
    .find(j.ImportDeclaration, {
      source: {
        value: "clsx",
      },
    })
    .find(j.ImportDefaultSpecifier)
    .forEach((path) => {
      // eslint-disable-next-line no-param-reassign
      path.node.local.name = "clsx";
    });
};

let clsxExpressionUsed = false;

/*
 * Add an import statement for clsx if it doesn't already exist
 */
const addClsxImport = (root) => {
  // Check if import statement for clsx already exists
  const existingImport = root.find(j.ImportDeclaration, {
    source: { value: "clsx" },
  });

  if (existingImport.length === 0) {
    // Create new import statement for clsx
    const newImport = j.importDeclaration(
      [j.importDefaultSpecifier(j.identifier("clsx"))],
      j.literal("clsx")
    );

    // Add the new import statement to the top of the program
    const { body } = root.get().value.program;
    body.unshift(newImport);
  }

  return root;
};

const isKebabCase = (prop: any, value: string) =>
  prop.type === "StringLiteral" && !!value.match(/-/);
/*
 * Find all the scss import statements that don't have a default specifier
 */
const getScssImports = (source: JSCodeshift) =>
  source.find(j.ImportDeclaration).filter((path) => {
    const { specifiers, source } = path.node;
    return specifiers.length === 0 && source.value.endsWith(".scss");
  });

/*
 * Rename styleName variable to className everywhere
 * before: const styleName = 'someClass'
 * after: const className = 'someClass'
 */
const renameStyleNameVariable = (source: JSCodeshift) => {
  source.find(j.Identifier).forEach((path) => {
    if (path.node.name === "styleName") {
      j(path).replaceWith(j.identifier("baseClassName"));
    }
  });
};

// if component has className prop along with styleName, remove className
// before: <div className="someClass" styleName="someOtherClass" />
// after: <div styleName="someOtherClass" />
const removeClassNamePropAndSaveValue = (openingElement) => {
  const classNameProp = null;
  const { attributes } = openingElement;
  const styleNameAttribute = attributes.find(
    (attr) => attr.type === "JSXAttribute" && attr.name.name === "styleName"
  );
  const classNameAttribute = attributes.find(
    (attr) => attr.type === "JSXAttribute" && attr.name.name === "className"
  );

  if (styleNameAttribute && classNameAttribute) {
    // Remove the classNameProp from the attributes array
    const index = attributes.indexOf(classNameAttribute);
    attributes.splice(index, 1);
    return classNameAttribute.value;
  }

  return null;
};

const modifyScssImports = (source: JSCodeshift) => {
  const scssImports = getScssImports(source);
  // replace the import statement with the css import statement
  const cssImportSpecifier = j.importDefaultSpecifier(j.identifier("styles"));

  scssImports.forEach((scssImport) =>
    j(scssImport).replaceWith(
      j.importDeclaration(
        [...scssImport.node.specifiers, cssImportSpecifier],
        scssImport.node.source
      )
    )
  );
};

/**
 * Transform the source code to replace {someClass: true} with {[styles.someClass]: true}
 * @param object
 */
const getClassNamesObjectProperties = (object: j.ObjectExpression) =>
  object.properties.map((prop) => {
    if (
      prop.type === "ObjectProperty" &&
      ["Identifier", "StringLiteral"].includes(prop.key.type)
    ) {
      // if it's shorthand property, don't do anything
      if (prop.shorthand) {
        return prop;
      }
      // if property key is kebab case, use computed property
      const computedPropertyNameExpression = j.memberExpression(
        j.identifier("styles"),
        prop.key,
        isKebabCase(prop.key, prop.key.value)
      );

      const property = j.objectProperty(
        computedPropertyNameExpression,
        prop.value
      );

      property.computed = true;

      return property;
    }

    // before { [`spacing-${direction}--${spacing}`]: true }
    // after { [styles[`spacing-${direction}--${spacing}`]]: true }
    if (prop.type === "ObjectProperty" && prop.key.type === "TemplateLiteral") {
      const computedPropertyNameExpression = j.memberExpression(
        j.identifier("styles"),
        prop.key,
        true
      );

      const property = j.objectProperty(
        computedPropertyNameExpression,
        prop.value
      );

      property.computed = true;

      return property;
    }

    return prop;
  });

/**
 * Modifies the clsx expression to use the styles object
 * Before:
 * clsx('someClass', className, { someOtherClass: true })
 * After:
 * clsx(styles.someClass, styles[className], { [styles.someOtherClass]: true })
 * @param callExpression
 */
const getModifiedClsxExpression = (
  callExpression: j.CallExpression,
  classNamePropValue = null
) =>
  j.callExpression(
    j.identifier("clsx"),
    callExpression.arguments.map((arg) => {
      if (classNamePropValue && arg === classNamePropValue) {
        // skip if the argument is className prop value (assuming that this is a global class names, e.g. ml-2, px-4)
        return arg;
      }
      // if the argument is a string, convert to styles.string
      if (arg.type === "StringLiteral") {
        // if the string is kebab case, use computed property (styles['some-class'])
        if (arg.value.match(/-/)) {
          return j.memberExpression(
            j.identifier("styles"),
            j.stringLiteral(arg.value),
            true
          );
        }

        return j.memberExpression(
          j.identifier("styles"),
          j.identifier(arg.value)
        );
      }

      // before: `flexbox-direction--${direction}`
      // after: styles[`flexbox-direction--${direction}`]
      if (arg.type === "TemplateLiteral") {
        return j.memberExpression(j.identifier("styles"), arg, true);
      }

      // if the argument is a variable, convert to [styles.variable] unless it's className
      if (arg.type === "Identifier" && arg.name !== "className") {
        return j.memberExpression(
          j.identifier("styles"),
          j.identifier(arg.name),
          true
        );
      }

      if (arg.type === "ObjectExpression") {
        const properties = getClassNamesObjectProperties(arg);
        return j.objectExpression(properties);
      }

      return arg;
    })
  );

/*
 * Transform the source code to replace "styleName" prop  with "className={styles[styleName]}"
 */
const modifyStyleNameExpression = (styleNameExpression: j.Expression) => {
  if (styleNameExpression.type === "MemberExpression") {
    return j.memberExpression(
      j.identifier("styles"),
      styleNameExpression.property
    );
  }

  return styleNameExpression;
};

const getClsxExpressionForClassNames = (
  styleNamePropValue,
  classNames: string[]
) =>
  j.callExpression(
    j.identifier("clsx"),
    classNames.map((className) => {
      const isClassInKebabCase = isKebabCase(styleNamePropValue, className);
      return j.memberExpression(
        j.identifier("styles"),
        isClassInKebabCase
          ? j.stringLiteral(className)
          : j.identifier(className),
        isClassInKebabCase
      );
    })
  );

/*
 * Transform the source code to replace multiple class names with clsx
 * before: styleName="someClass someOtherClass"
 * after: className={clsx(styles.someClass, styles.someOtherClass)}
 */
const transformClassNamesToClsx = (styleNameProp, styleNamePropValue) => {
  const classNames = styleNamePropValue.value.split(" ");
  const clsxExpression = getClsxExpressionForClassNames(
    styleNamePropValue,
    classNames
  );

  j(styleNameProp).replaceWith(
    j.jsxAttribute(
      j.jsxIdentifier("className"),
      j.jsxExpressionContainer(clsxExpression)
    )
  );

  clsxExpressionUsed = true;
};

/*
 * Transform the source code to replace "styleName" prop  with "className={styles[styleName]}"
 *
 */
const modifyStyleNameProp = (
  styleNameProps: j.JSXAttribute[],
  source: JSCodeshift
) => {
  styleNameProps.forEach((prop) => {
    const styleNameProp = prop;
    const styleNamePropValue = styleNameProp.node.value;
    const openingElement = styleNameProp.parent.node;

    // remove outdated className prop
    const classNamePropValue =
      removeClassNamePropAndSaveValue(openingElement) || null;

    // if styleName is a string of classes separated by a space, add them one by one to the className
    // before: styleName="someClass someOtherClass"
    // after: className={clsx(styles.someClass, styles.someOtherClass)}
    if (
      styleNamePropValue.type === "StringLiteral" &&
      styleNamePropValue.value.split(" ").length > 1
    ) {
      transformClassNamesToClsx(styleNameProp, styleNamePropValue);
      return;
    }

    const isKeyInKebabCase = isKebabCase(
      styleNamePropValue,
      styleNamePropValue.value
    );

    j(styleNameProp).replaceWith(
      j.jsxAttribute(
        j.jsxIdentifier("className"),
        j.jsxExpressionContainer(
          styleNamePropValue.type === "JSXExpressionContainer"
            ? modifyStyleNameExpression(styleNamePropValue.expression)
            : j.memberExpression(
                j.identifier("styles"),
                isKeyInKebabCase
                  ? j.stringLiteral(styleNamePropValue.value)
                  : j.identifier(styleNamePropValue.value),
                isKeyInKebabCase
              )
        )
      )
    );

    // if classNamePropValue is not null and a string, append it to the clsx expression
    if (classNamePropValue && classNamePropValue?.type === "StringLiteral") {
      j(styleNameProp).replaceWith(
        j.jsxAttribute(
          j.jsxIdentifier("className"),
          j.jsxExpressionContainer(
            j.callExpression(j.identifier("clsx"), [
              styleNamePropValue,
              classNamePropValue,
            ])
          )
        )
      );

      clsxExpressionUsed = true;
    }

    // find clsx expression in styleName prop
    const clsxExpressionCollection = j(styleNameProp).find(j.CallExpression, {
      callee: {
        name: "clsx",
      },
    });

    clsxExpressionCollection.forEach((clsxExpression) => {
      j(clsxExpression).replaceWith(
        getModifiedClsxExpression(clsxExpression.node, classNamePropValue)
      );
    });
  });

  const clsxExpression = source.find(j.CallExpression).filter((path) => {
    // filter out those clsx calls that are in JSXExpressionContainer

    const parent = path.parent.node;
    return (
      path.node.callee.name === "clsx" &&
      parent.type !== "JSXExpressionContainer"
    );
  });

  clsxExpression.forEach((clsx) => {
    j(clsx).replaceWith(getModifiedClsxExpression(clsx.node));
  });

  // in case if styleName is a separate variable (all clsx calls are replaced by this point)
  // rename styleName variable to baseClassName
  renameStyleNameVariable(source);
};

const transform: Transform = (file) => {
  const parsed = j.withParser("tsx")(file.source);

  if (getScssImports(parsed).length) {
    const styleNameProps = parsed
      .find(j.JSXAttribute)
      .filter((path) => path.node.name.name === "styleName");

    if (styleNameProps.length) {
      modifyScssImports(parsed);
      modifyStyleNameProp(styleNameProps, parsed);
    }
  }

  if (clsxExpressionUsed) {
    renameClsxImportIdentifier(parsed);
    addClsxImport(parsed);

    clsxExpressionUsed = false;
  }

  const outputOptions = {
    quote: "single",
    trailingComma: true,
  };

  return parsed.toSource(outputOptions);
};

export default transform;
