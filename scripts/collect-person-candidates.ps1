$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$projectRoot = Split-Path -Parent $PSScriptRoot
$headers = @{ 'User-Agent' = 'ChinesePhilosophyAtlas/0.1 (research candidate discovery)' }
function Invoke-Json([string]$Uri) {
  for ($attempt = 1; $attempt -le 6; $attempt++) {
    try {
      $result = Invoke-RestMethod -Uri $Uri -Headers $headers -TimeoutSec 60
      Start-Sleep -Milliseconds 350
      return $result
    } catch {
      if ($attempt -eq 6) { throw }
      Start-Sleep -Seconds ([Math]::Min(12, $attempt * 3))
    }
  }
}
$seeds = @(
  'Category:中国哲学家',
  'Category:中国思想家',
  'Category:中国儒学学者',
  'Category:新儒家学者',
  'Category:中国逻辑学家',
  'Category:中国伦理学家',
  'Category:中国佛教哲学家'
)
$existingNames = [Collections.Generic.HashSet[string]]::new()
Import-Csv -LiteralPath (Join-Path $projectRoot 'data\people_i18n.csv') | ForEach-Object {
  [void]$existingNames.Add($_.name_zh)
  foreach ($alias in ($_.aliases_zh -split ';')) { if ($alias) { [void]$existingNames.Add($alias.Trim()) } }
}

$discovered = @{}
$seenCategories = [Collections.Generic.HashSet[string]]::new()
$queue = [Collections.Generic.Queue[object]]::new()
foreach ($seed in $seeds) { $queue.Enqueue([pscustomobject]@{ title = $seed; depth = 0 }) }
while ($queue.Count -gt 0) {
  $entry = $queue.Dequeue()
  $category = $entry.title
  if (-not $seenCategories.Add($category)) { continue }
  $continue = $null
  do {
    $uri = 'https://zh.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=' + [Uri]::EscapeDataString($category) + '&cmlimit=500&cmtype=page%7Csubcat&format=json&origin=*'
    if ($continue) { $uri += '&cmcontinue=' + [Uri]::EscapeDataString($continue) }
    $payload = Invoke-Json $uri
    foreach ($member in $payload.query.categorymembers) {
      if ($member.ns -eq 14) {
        if ($entry.depth -lt 2 -and $member.title -match '哲学家|思想家|儒学|理学家|经学家|逻辑学家|伦理学家') { $queue.Enqueue([pscustomobject]@{ title = $member.title; depth = $entry.depth + 1 }) }
        continue
      }
      if (-not $discovered.ContainsKey($member.title)) {
        $discovered[$member.title] = [ordered]@{ pageid = $member.pageid; categories = [Collections.Generic.HashSet[string]]::new() }
      }
      $categoryName = $category -replace '^Category:', ''
      [void]$discovered[$member.title].categories.Add($categoryName)
    }
    $continue = $payload.continue.cmcontinue
  } while ($continue)
}

$titles = @($discovered.Keys | Sort-Object)
$pageData = @{}
for ($offset = 0; $offset -lt $titles.Count; $offset += 30) {
  $last = [Math]::Min($offset + 29, $titles.Count - 1)
  $batch = $titles[$offset..$last] -join '|'
  $uri = 'https://zh.wikipedia.org/w/api.php?action=query&titles=' + [Uri]::EscapeDataString($batch) + '&prop=pageprops%7Cinfo&inprop=url&format=json&origin=*'
  $payload = Invoke-Json $uri
  foreach ($page in $payload.query.pages.PSObject.Properties.Value) { $pageData[$page.title] = $page }
}

$retrievedAt = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd')
$rows = foreach ($title in $titles) {
  $page = $pageData[$title]
  $qid = $page.pageprops.wikibase_item
  [pscustomobject]@{
    candidate_id = if ($qid) { $qid } else { "zhwiki-$($discovered[$title].pageid)" }
    name_zh = $title
    wikidata_id = $qid
    discovery_categories = (@($discovered[$title].categories) | Sort-Object) -join ';'
    discovery_source = $page.fullurl
    already_in_corpus = if ($existingNames.Contains($title)) { 'true' } else { 'false' }
    candidate_status = if ($existingNames.Contains($title)) { 'already-included' } else { 'awaiting-scope-review' }
    retrieved_at = $retrievedAt
  }
}

$output = Join-Path $projectRoot 'data\research\person_candidates.csv'
$rows | Export-Csv -LiteralPath $output -NoTypeInformation -Encoding utf8
$newCount = @($rows | Where-Object already_in_corpus -eq 'false').Count
Write-Host "Person candidate discovery complete: $($rows.Count) total, $newCount new candidates, $($rows.Count - $newCount) already represented."
