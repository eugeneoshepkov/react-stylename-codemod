/*
   Test jscodeshift codemod script
 */

import j from "jscodeshift";
import transform from "./stylename-codemod";
import { describe, it, expect } from "vitest";

describe("styleName-codemod", () => {
  const api = { j } as any;
  it("should convert styleName to className", () => {
    const source = `
         import React from 'react';
         import clsx from 'clsx';
         import './styles.scss';
   
         const Button = ({ className }) => {
           const name = 'some-class'
           return (
             <button
               className={className}
               styleName={clsx('some-class', \`string-template-\$\{name\}\`, className)}
             >
               Click me
             </button>
           );
         };
   
         export default Button;
       `;

    const result = transform({ source, path: "/" }, api, {});

    expect(result).toMatchInlineSnapshot(`
      "
               import React from 'react';
               import clsx from 'clsx';
               import styles from './styles.scss';
         
               const Button = ({ className }) => {
                 const name = 'some-class'
                 return (
                   <button
                     className={clsx(styles['some-class'], styles[\`string-template-\${name}\`], className)}>
                     Click me
                   </button>
                 );
               };
         
               export default Button;
             "
    `);
  });

  it("should convert styleName to className with object expression", () => {
    const source = `
         import React from 'react';
         import clsx from 'clsx';
         import './styles.scss';
   
         const Button = ({ className }) => {
           return (
             <button
               className={className}
               styleName={clsx({className, 'kebab-case': true, camelCase: true })}
             >
               Click me
             </button>
           );
         };
   
         export default Button;
       `;

    const result = transform({ source, path: "/" }, api, {});

    expect(result).toMatchInlineSnapshot(`
      "
               import React from 'react';
               import clsx from 'clsx';
               import styles from './styles.scss';
         
               const Button = ({ className }) => {
                 return (
                   <button
                     className={clsx({
                       className,
                       [styles['kebab-case']]: true,
                       [styles.camelCase]: true,
                     })}>
                     Click me
                   </button>
                 );
               };
         
               export default Button;
             "
    `);
  });

  it("should convert styleName to className when it's defined as a separate styleName variable ", () => {
    const source = `
         import React from 'react';
         import clsx from 'clsx';
         import './styles.scss';
   
         const Button = ({ className }) => {
           const styleName = clsx('some-class', className);
           return (
             <button
               className={className}
               styleName={styleName}
             >
               Click me
             </button>
           );
         };
   
         export default Button;
       `;

    const result = transform({ source, path: "/" }, api, {});

    expect(result).toMatchInlineSnapshot(`
      "
               import React from 'react';
               import clsx from 'clsx';
               import styles from './styles.scss';
         
               const Button = ({ className }) => {
                 const baseClassName = clsx(styles['some-class'], className);
                 return (
                   <button className={baseClassName}>
                     Click me
                   </button>
                 );
               };
         
               export default Button;
             "
    `);
  });

  it("should transform multiple components in a single file", () => {
    const source = `
         import React from 'react';
         import clsx from 'clsx';
         import './styles.scss';
   
         const Button = ({ className }) => {
           const styleName = clsx('some-class', className);
           return (
             <button
               className={className}
               styleName={styleName}
             >
               Click me
             </button>
           );
         };
   
         const Link = () => {
           return (
             <a
               styleName="someClass another-class and-one-more"
             >
               Click me
             </a>
           );
         };
   
         export default Button;
       `;

    const result = transform({ source, path: "/" }, api, {});

    expect(result).toMatchInlineSnapshot(`
      "
               import React from 'react';
               import clsx from 'clsx';
               import styles from './styles.scss';
         
               const Button = ({ className }) => {
                 const baseClassName = clsx(styles['some-class'], className);
                 return (
                   <button className={baseClassName}>
                     Click me
                   </button>
                 );
               };
         
               const Link = () => {
                 return (
                   <a
                     className={clsx(styles.someClass, styles['another-class'], styles['and-one-more'])}
                   >
                     Click me
                   </a>
                 );
               };
         
               export default Button;
             "
    `);
  });

  it("should keep className prop of different components but remove it if styleName is also present", () => {
    const source = `
         import React from 'react';
         import clsx from 'clsx';
         import './styles.scss';
   
         const Button = ({ className, wrapperClassName }) => {
           return (
               <div className={wrapperClassName}>
               <button
                 className={className}
                 styleName={clsx('some-class', className)}
               >
                 Click me
               </button>
             </div>
           );
         };
       `;

    const result = transform({ source, path: "/" }, api, {});

    expect(result).toMatchInlineSnapshot(`
      "
               import React from 'react';
               import clsx from 'clsx';
               import styles from './styles.scss';
         
               const Button = ({ className, wrapperClassName }) => {
                 return (
                   <div className={wrapperClassName}>
                   <button className={clsx(styles['some-class'], className)}>
                     Click me
                   </button>
                 </div>
                 );
               };
             "
    `);
  });

  it("should add clsx import if it is not present but was used in transformation", () => {
    const source = `
         import React from 'react';
         import './styles.scss';
   
         const Button = ({ className }) => {
           return (
             <button
               className={className}
               styleName="some-class another-class"
             >
               Click me
             </button>
           );
         };
       `;

    const result = transform({ source, path: "/" }, api, {});

    expect(result).toMatchInlineSnapshot(`
      "
               import clsx from 'clsx';
               import React from 'react';
               import styles from './styles.scss';

               const Button = ({ className }) => {
                 return (
                   <button className={clsx(styles['some-class'], styles['another-class'])}>
                     Click me
                   </button>
                 );
               };
             "
    `);
  });

  it("should rename default identifier of clsx import if it is not clsx", () => {
    const source = `
         import React from 'react';
         import cn from 'clsx';
         import './styles.scss';
   
         const Button = ({ className }) => {
           return (
             <button
               className={className}
               styleName="some-class another-class"
             >
               Click me
             </button>
           );
         };
       `;

    const result = transform({ source, path: "/" }, api, {});

    expect(result).toMatchInlineSnapshot(`
      "
               import React from 'react';
               import clsx from 'clsx';
               import styles from './styles.scss';
         
               const Button = ({ className }) => {
                 return (
                   <button className={clsx(styles['some-class'], styles['another-class'])}>
                     Click me
                   </button>
                 );
               };
             "
    `);
  });

  it("should not modify scss import if there is no styleName prop", () => {
    const source = `
         import React from 'react';
         import './styles.scss';
   
         const Button = ({ className }) => {
           return (
             <button
               className={className}
             >
               Click me
             </button>
           );
         };
       `;

    const result = transform({ source, path: "/" }, api, {});

    expect(result).toMatchInlineSnapshot(`
      "
               import React from 'react';
               import './styles.scss';
         
               const Button = ({ className }) => {
                 return (
                   <button
                     className={className}
                   >
                     Click me
                   </button>
                 );
               };
             "
    `);
  });
});
