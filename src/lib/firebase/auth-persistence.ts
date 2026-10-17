import { browserSessionPersistence, type Persistence } from 'firebase/auth';

// Web preview uses tab-scoped browser storage. Native has a SecureStore adapter.
export const authPersistence: Persistence = browserSessionPersistence;
