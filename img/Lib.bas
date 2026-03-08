Attribute VB_Name = "Module2"
Sub Libr()
    Dim sh As Shape
    Dim cyanShapes As New Collection
    Dim zeroX As Double, zeroY As Double
    Dim pinCounter As Long
    Const GRID_STEP As Double = 2.5
    
    ActiveDocument.Unit = cdrMillimeter
    
    If ActiveSelection.Shapes.Count = 0 Then
        Debug.Print "Ошибка: Ничего не выделено!"
        Exit Sub
    End If

    ' 1. Ищем реперы (Cyan)
    For Each sh In ActiveSelection.Shapes
        CollectCyanShapes sh, cyanShapes
    Next sh

    If cyanShapes.Count <> 2 Then
        Debug.Print "Ошибка: Нужно 2 объекта Cyan. Найдено: " & cyanShapes.Count
        Exit Sub
    End If

    ' 2. ТОЧНЫЙ РАСЧЕТ НУЛЯ (без сетки)
    Dim s1 As Shape, s2 As Shape
    Set s1 = cyanShapes(1): Set s2 = cyanShapes(2)
    
    If s1.SizeHeight > s1.SizeWidth And s2.SizeWidth > s2.SizeHeight Then
        zeroX = s1.CenterX
        zeroY = s2.CenterY
    ElseIf s2.SizeHeight > s2.SizeWidth And s1.SizeWidth > s1.SizeHeight Then
        zeroX = s2.CenterX
        zeroY = s1.CenterY
    Else
        zeroX = (s1.CenterX + s2.CenterX) / 2
        zeroY = (s1.CenterY + s2.CenterY) / 2
    End If
    
    Debug.Print "--------------------------------------------------"
    Debug.Print "ORIGIN (EXACT): " & Replace(Round(zeroX, 3), ",", ".") & ", " & Replace(Round(zeroY, 3), ",", ".")
    
    ' 3. PRIMITIVES — РЕАЛЬНЫЕ КООРДИНАТЫ
    Debug.Print "PRIMITIVES"
    For Each sh In ActiveSelection.Shapes
        ProcessRecursive sh, 1, zeroX, zeroY, pinCounter, GRID_STEP
    Next sh
    
    Debug.Print ""
    
    ' 4. PINS — ОКРУГЛЕНИЕ ДО 2.5
    Debug.Print "PINS"
    pinCounter = 1
    For Each sh In ActiveSelection.Shapes
        ProcessRecursive sh, 2, zeroX, zeroY, pinCounter, GRID_STEP
    Next sh
End Sub

' Функция привязки к сетке (используется только для пинов)
Private Function SnapToGrid(val As Double, step As Double) As Double
    SnapToGrid = Round(val / step, 0) * step
End Function

Private Sub ProcessRecursive(sh As Shape, mode As Integer, zX As Double, zY As Double, ByRef pIdx As Long, gStep As Double)
    Dim subsh As Shape
    If sh.Type = cdrGroupShape Then
        For Each subsh In sh.Shapes
            ProcessRecursive subsh, mode, zX, zY, pIdx, gStep
        Next subsh
    Else
        If IsColor(sh, 100, 0, 0, 0) Then Exit Sub

        Dim isMag As Boolean
        isMag = IsColor(sh, 0, 100, 0, 0)
        
        If mode = 1 Then
            ' Только кривые, координаты реальные
            If Not isMag And sh.Type = cdrCurveShape Then
                PrintNodes sh, zX, zY
            End If
        ElseIf mode = 2 Then
            ' Только малиновые пины, координаты по сетке
            If isMag Then
                Dim px As Double, py As Double
                px = SnapToGrid(sh.CenterX - zX, gStep)
                py = SnapToGrid(-(sh.CenterY - zY), gStep)
                Debug.Print "PIN" & pIdx & ":" & Replace(px, ",", ".") & "," & Replace(py, ",", ".") & ";"
                pIdx = pIdx + 1
            End If
        End If
    End If
End Sub

Private Sub PrintNodes(sh As Shape, zX As Double, zY As Double)
    Dim n As Node
    Dim ostr As String
    ostr = "("
    For Each n In sh.Curve.Nodes
        ' Вывод как есть, без привязки к GRID_STEP
        Dim nx As String, ny As String
        nx = Replace(Round(n.PositionX - zX, 2), ",", ".")
        ny = Replace(Round(-(n.PositionY - zY), 3), ",", ".")
        ostr = ostr & nx & "," & ny & ","
    Next n
    If Len(ostr) > 1 Then
        Debug.Print Left(ostr, Len(ostr) - 1) & ");"
    End If
End Sub

' --- Технические функции поиска цвета ---

Private Sub CollectCyanShapes(sh As Shape, col As Collection)
    Dim subsh As Shape
    If sh.Type = cdrGroupShape Then
        For Each subsh In sh.Shapes
            CollectCyanShapes subsh, col
        Next subsh
    Else
        If IsColor(sh, 100, 0, 0, 0) Then col.Add sh
    End If
End Sub

Private Function IsColor(sh As Shape, c As Integer, m As Integer, y As Integer, k As Integer) As Boolean
    IsColor = False
    Dim clr As Color
    If sh.Fill.Type = cdrUniformFill Then
        Set clr = sh.Fill.UniformColor
        If clr.Type = cdrColorCMYK Then
            If clr.CMYKCyan = c And clr.CMYKMagenta = m And clr.CMYKYellow = y And clr.CMYKBlack = k Then IsColor = True: Exit Function
        End If
    End If
    If sh.Outline.Type <> cdrNoOutline Then
        Set clr = sh.Outline.Color
        If clr.Type = cdrColorCMYK Then
            If clr.CMYKCyan = c And clr.CMYKMagenta = m And clr.CMYKYellow = y And clr.CMYKBlack = k Then IsColor = True
        End If
    End If
End Function
