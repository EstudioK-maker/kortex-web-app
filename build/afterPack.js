// afterPack.js — aplica ícone e metadados de versão ao Kortex.exe SEM wine
// (o electron-builder usa rcedit+wine nesta fase; em Linux substituímos por resedit, JS puro)
const fs = require('fs');
const path = require('path');
const { NtExecutable, NtExecutableResource, Data, Resource } = require('resedit');

exports.default = async function (context) {
  const appOutDir = context.appOutDir || (context.packager && context.packager.appOutDir);
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const appInfo = (context.packager && context.packager.appInfo) || null;
  const product = (appInfo && appInfo.productFilename) || pkg.build.productName || 'Kortex';
  const exePath = path.join(appOutDir, product + '.exe');
  const iconPath = path.join(__dirname, '..', 'icon.ico');
  const version = pkg.version; // 1.0.47

  if (!fs.existsSync(exePath)) {
    console.log(`  [afterPack] AVISO: ${exePath} não existe — a ignorar edição de recursos`);
    return;
  }
  const exe = NtExecutable.from(fs.readFileSync(exePath));
  const res = NtExecutableResource.from(exe);

  // 1) ícone: substitui o grupo de ícones existente (do electron) pelo Kortex
  const iconFile = Data.IconFile.from(fs.readFileSync(iconPath));
  const groupIds = Resource.IconGroupEntry.fromEntries(res.entries).map((e) => e.id);
  const groupId = groupIds.length ? groupIds[0] : 1;
  Resource.IconGroupEntry.replaceIconsForResource(
    res.entries,
    groupId,
    1033,
    iconFile.icons.map((item) => item.data)
  );

  // 2) versão + metadados
  const v = version.split('.').map((n) => parseInt(n, 10) || 0);
  const viList = Resource.VersionInfo.fromEntries(res.entries);
  const vi = viList.length ? viList[0] : Resource.VersionInfo.createEmpty();
  vi.setFileVersion(v[0] || 0, v[1] || 0, v[2] || 0, 0, 1033);
  vi.setProductVersion(v[0] || 0, v[1] || 0, v[2] || 0, 0, 1033);
  vi.setStringValues({ lang: 1033, codepage: 1200 }, {
    FileDescription: 'Kortex Browser',
    ProductName: 'Kortex',
    CompanyName: 'EstudioK',
    OriginalFilename: product + '.exe',
  });
  vi.outputToResourceEntries(res.entries);

  res.outputResource(exe);
  fs.writeFileSync(exePath, Buffer.from(exe.generate()));
  console.log(`  [afterPack] ícone (${iconFile.icons.length} tamanhos) + versão ${version} aplicados a ${path.basename(appOutDir)}/${product}.exe`);
};
