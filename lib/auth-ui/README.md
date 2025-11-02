# @gql-cms/auth-ui

## Development
UI components development is based on StoryBook. On root level run
```bash
    nx storybook @gql-cms/auth-ui
```

## Running unit tests

* **Interactive tests** in StoryBook are the base TDD development pattern.
The individual component StoryBook includes the 
[interactive tests](https://storybook.js.org/tutorials/ui-testing-handbook/react/en/interaction-testing/) runner. 

To see all tests results, run in separate terminals
```bash
    nx run @gql-cms/auth-ui:storybook --port=44555 
    nx test-storybook @gql-cms/auth-ui -url  http://localhost:44555/ # use url from 
```
* **Unit tests** 
Run `nx test @gql-cms/auth-ui` to execute the unit tests via [Vitest](https://vitest.dev/).
