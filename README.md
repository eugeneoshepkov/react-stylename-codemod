# Codemod to transform styleName to className prop

This is a codemod, written using [jscodeshift](https://github.com/facebook/jscodeshift). It's built to simplify code migration from [babel-plugin-react-css-modules](https://github.com/gajus/babel-plugin-react-css-modules)

## How it works

This codemod performs the following transformations to the source code:

<ol><li>Renames the <code>styleName</code> attribute to <code>className</code> in JSX elements.</li><li>Modifies the <code>className</code> value to use the imported <code>styles</code> object.</li><li>Replaces multiple class names in a <code>styleName</code> attribute with a <code>clsx</code> expression.</li><li>Adds the <code>clsx</code> import if not already present.</li><li>Renames the import identifier for <code>clsx</code> if it's not 'clsx'.</li><li>Updates the SCSS import statements to import the CSS modules as 'styles'.</li><li>Removes the <code>className</code> attribute from JSX elements if they also have a <code>styleName</code> attribute.</li></ol>

## Pre-requisites

This codemod requires the following:

<ol><li>Node.js 10.13.0 or later</li><li>jscodeshift v0.13.0</li></ol>

## Usage

To use this codemod, simply run the following command:

```bash
jscodeshift -t path/to/this/codemod.ts path/to/your/source/code

#example
jscodeshift -t node_modules/eugeneo/react-stylename-codemod/codemod.ts ./src/* --extensions=tsx
```

Please note that this codemod assumes the use of the styles object imported from the SCSS files and the clsx library for handling multiple or conditional class names. Make sure to install the clsx library if you haven't already:

```
yarn install clsx
```

⚠️ After running the codemod, make sure to test your application thoroughly to ensure that the styling is working as expected.

### Example transformation

### Before:

```tsx
import React from "react";
import cn from "clsx";
import "./MyComponent.scss";

const MyComponent = ({ isActive, className }) => {
  return (
    <div
      className={cn(className, { "active-class": isActive })}
      styleName="camelCase kebab-case"
    >
      Hello World
    </div>
  );
};

export default MyComponent;
```

### After:

```tsx
import React from 'react';
import clsx from 'clsx';
import styles from './MyComponent.scss';

const MyComponent = ({ isActive, className }) => {
  return (
    <div
      className={clsx(
        className,
        { [styles['active-class']]: isActive },
        styles.camelCase,
        styles.['kebab-case']
      )}
    >
      Hello World
    </div>
  );
};

export default MyComponent;

```

In this example, the following transformations have occurred:

<ol><li>The <code>cn</code> import has been renamed to <code>clsx</code>.</li><li>The SCSS import has been updated to import the CSS module as 'styles'.</li><li>The <code>styleName</code> attribute has been replaced with a <code>className</code></li><li>The <code>clsx</code> expression now utilizes the <code>styles</code> object.</li></ol>
