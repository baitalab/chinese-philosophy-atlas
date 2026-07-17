$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$projectRoot = Split-Path -Parent $PSScriptRoot
$dataDir = Join-Path $projectRoot 'data'
$portraitDir = Join-Path $projectRoot 'public\portraits'
$headers = @{ 'User-Agent' = 'ChinesePhilosophyAtlas/0.1 (research portrait provenance pipeline)' }
New-Item -ItemType Directory -Force -Path $portraitDir | Out-Null

$neutral = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="64" fill="#ddd8cc"/><circle cx="64" cy="47" r="24" fill="#77756f"/><path d="M22 119c4-29 19-43 42-43s38 14 42 43" fill="#77756f"/></svg>'
Set-Content -LiteralPath (Join-Path $portraitDir '_neutral.svg') -Value $neutral -Encoding utf8

$people = Import-Csv -LiteralPath (Join-Path $dataDir 'people.csv')
$names = @{}
Import-Csv -LiteralPath (Join-Path $dataDir 'people_i18n.csv') | ForEach-Object { $names[$_.id] = $_ }
$qidByPerson = @{}

for ($offset = 0; $offset -lt $people.Count; $offset += 30) {
  $last = [Math]::Min($offset + 29, $people.Count - 1)
  $batch = $people[$offset..$last]
  $titles = ($batch | ForEach-Object { $names[$_.id].name_zh }) -join '|'
  $uri = 'https://zh.wikipedia.org/w/api.php?action=query&titles=' + [Uri]::EscapeDataString($titles) + '&redirects=1&prop=pageprops&format=json&origin=*'
  $payload = Invoke-RestMethod -Uri $uri -Headers $headers -TimeoutSec 60
  $resolved = @{}
  foreach ($person in $batch) { $resolved[$names[$person.id].name_zh] = $names[$person.id].name_zh }
  foreach ($item in @($payload.query.normalized)) { if ($item) { $resolved[$item.from] = $item.to } }
  foreach ($item in @($payload.query.redirects)) {
    if (-not $item) { continue }
    foreach ($key in @($resolved.Keys)) { if ($resolved[$key] -eq $item.from) { $resolved[$key] = $item.to } }
  }
  $pageByTitle = @{}
  foreach ($page in $payload.query.pages.PSObject.Properties.Value) { $pageByTitle[$page.title] = $page }
  foreach ($person in $batch) {
    $title = $resolved[$names[$person.id].name_zh]
    if ($pageByTitle[$title].pageprops.wikibase_item) { $qidByPerson[$person.id] = $pageByTitle[$title].pageprops.wikibase_item }
  }
}
Write-Host "Exact Wikipedia/Wikidata entity matches: $($qidByPerson.Count)/$($people.Count)"

$entities = @{}
$qids = @($qidByPerson.Values | Sort-Object -Unique)
for ($offset = 0; $offset -lt $qids.Count; $offset += 40) {
  $last = [Math]::Min($offset + 39, $qids.Count - 1)
  $ids = $qids[$offset..$last] -join '|'
  $uri = 'https://www.wikidata.org/w/api.php?action=wbgetentities&ids=' + [Uri]::EscapeDataString($ids) + '&props=claims%7Clabels%7Cdescriptions&languages=zh%7Cen&format=json&origin=*'
  $payload = Invoke-RestMethod -Uri $uri -Headers $headers -TimeoutSec 60
  foreach ($property in $payload.entities.PSObject.Properties) { $entities[$property.Name] = $property.Value }
}

$fileByPerson = @{}
foreach ($person in $people) {
  $qid = $qidByPerson[$person.id]
  if (-not $qid) { continue }
  $claim = @($entities[$qid].claims.P18)[0]
  if ($claim) { $fileByPerson[$person.id] = $claim.mainsnak.datavalue.value }
}

$metadata = @{}
$files = @($fileByPerson.Values | Sort-Object -Unique)
for ($offset = 0; $offset -lt $files.Count; $offset += 30) {
  $last = [Math]::Min($offset + 29, $files.Count - 1)
  $titles = ($files[$offset..$last] | ForEach-Object { 'File:' + $_ }) -join '|'
  $uri = 'https://commons.wikimedia.org/w/api.php?action=query&titles=' + [Uri]::EscapeDataString($titles) + '&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=256&format=json&origin=*'
  $payload = Invoke-RestMethod -Uri $uri -Headers $headers -TimeoutSec 60
  foreach ($page in $payload.query.pages.PSObject.Properties.Value) {
    $info = @($page.imageinfo)[0]
    if ($info) { $metadata[$page.title -replace '^File:', ''] = $info }
  }
}

$rows = foreach ($person in $people) {
  $qid = $qidByPerson[$person.id]
  $file = $fileByPerson[$person.id]
  $info = if ($file) { $metadata[$file] } else { $null }
  $localPath = '/portraits/_neutral.svg'
  $kind = 'neutral-placeholder'
  $status = 'needs-portrait-review'
  $notes = if ($qid) { 'Exact Chinese Wikipedia title or redirect; no reusable P18 image resolved.' } else { 'No exact Chinese Wikipedia entity match.' }
  if ($info.thumburl) {
    $extension = if ($info.thumburl -match '\.png(?:$|\?)') { 'png' } elseif ($info.thumburl -match '\.webp(?:$|\?)') { 'webp' } elseif ($info.thumburl -match '\.svg(?:$|\?)') { 'svg' } else { 'jpg' }
    $filename = "$($person.id).$extension"
    try {
      Invoke-WebRequest -Uri $info.thumburl -Headers $headers -OutFile (Join-Path $portraitDir $filename) -TimeoutSec 90
      $localPath = "/portraits/$filename"
      $kind = 'sourced-image'
      $status = 'candidate-auto'
      $notes = 'Exact Chinese Wikipedia title or redirect with Wikidata P18; requires final visual identity review.'
    } catch {
      $notes = "Image download failed: $($_.Exception.Message)"
    }
  }
  $ext = $info.extmetadata
  [pscustomobject]@{
    person_id = $person.id
    kind = $kind
    local_path = $localPath
    wikidata_id = $qid
    source_url = if ($info.descriptionurl) { $info.descriptionurl } elseif ($qid) { "https://www.wikidata.org/wiki/$qid" } else { '' }
    file_title = $file
    author = if ($ext.Artist.value) { ($ext.Artist.value -replace '<[^>]*>', ' ' -replace '\s+', ' ').Trim() } else { '' }
    license = if ($ext.LicenseShortName.value) { ($ext.LicenseShortName.value -replace '<[^>]*>', ' ').Trim() } else { '' }
    license_url = $ext.LicenseUrl.value
    review_status = $status
    match_method = if ($qid) { 'zhwiki-exact-title-or-redirect' } else { 'none' }
    notes = $notes
  }
}

$rows | Export-Csv -LiteralPath (Join-Path $dataDir 'portraits.csv') -NoTypeInformation -Encoding utf8
$sourced = @($rows | Where-Object kind -eq 'sourced-image').Count
Write-Host "Portrait index complete: $sourced sourced images, $($rows.Count - $sourced) explicit neutral placeholders, $($rows.Count) people covered."
