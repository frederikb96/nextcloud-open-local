/** Name the native messaging host is registered under; the opener and the manifests use the same. */
export const NATIVE_HOST = 'nextcloud_open_local';

/**
 * Public half of the key that fixes the extension id, so the id does not depend on the folder an
 * unpacked copy is loaded from. The opener's install command allows exactly this id.
 */
export const EXTENSION_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAhvQfQT0w3vhEx/bvwfQ5mZjvcnVcTvjAPel8eZzTMuGdWagEua1meAP9XBlhChZn/XcVNslEvYV1pUH2goVGP9iPYkfOIIsSFrUYfn+ZLeDrBzUzTq2liaUbagTW7/veWtRHR0gxosUT+W2CS0H4o0UQ6jxFCugXfdwQdTvnk+D+J/4RKnGwKTOCX/eY+biFu33r7pgZQJ9f7gvMWqonvavaVZ5KAHu9S4PuQpLf+SV94FRKcHOgpLHAZGOM7DhFxQto9b/JyRKc2b0xZoa9tbg3xoM3W/SspU6QRqkXeacUPUQEYrEl+gDdvrW76Ww+R/RbVMXlypmP0I8Jl2lTVQIDAQAB';
