import { render } from '@testing-library/react';

import GqlCmsAuthUi from './auth-ui';

describe('GqlCmsAuthUi', () => {
    it('should render successfully', () => {
        const { baseElement } = render(<GqlCmsAuthUi />);
        expect(baseElement).toBeTruthy();
    });
});
