const fs = require('fs');
const path = require('path');

const projectRoot = process.env.CODEX_WORKDIR_REALPATH_ROOT;
const normalizedProjectRoot = projectRoot ? path.resolve(projectRoot).toLowerCase() : null;

function shouldPreservePath(target) {
  if (!normalizedProjectRoot || typeof target !== 'string') {
    return false;
  }

  const resolved = path.resolve(target).toLowerCase();
  return (
    resolved === normalizedProjectRoot ||
    resolved.startsWith(normalizedProjectRoot + path.sep.toLowerCase())
  );
}

const originalRealpathSync = fs.realpathSync.bind(fs);
const originalRealpathSyncNative =
  typeof fs.realpathSync.native === 'function' ? fs.realpathSync.native.bind(fs.realpathSync) : null;
const originalRealpath = fs.realpath.bind(fs);
const originalPromisesRealpath = fs.promises.realpath.bind(fs.promises);

fs.realpathSync = function patchedRealpathSync(target, options) {
  if (shouldPreservePath(target)) {
    return path.resolve(target);
  }
  return originalRealpathSync(target, options);
};

if (originalRealpathSyncNative) {
  fs.realpathSync.native = function patchedRealpathSyncNative(target, options) {
    if (shouldPreservePath(target)) {
      return path.resolve(target);
    }
    return originalRealpathSyncNative(target, options);
  };
}

fs.realpath = function patchedRealpath(target, options, callback) {
  const cb = typeof options === 'function' ? options : callback;
  if (shouldPreservePath(target)) {
    queueMicrotask(() => cb(null, path.resolve(target)));
    return;
  }
  return originalRealpath(target, options, callback);
};

fs.promises.realpath = async function patchedPromisesRealpath(target, options) {
  if (shouldPreservePath(target)) {
    return path.resolve(target);
  }
  return originalPromisesRealpath(target, options);
};
